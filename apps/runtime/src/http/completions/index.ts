import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { evaluatePolicy, type PolicyInput } from "../../policy/policy";
import { callRouteProvider } from "../../core/providerRouter";
import { finalize, getRouteSpendTodayUsd, getTenantSpendTodayUsd } from "../../policy/budget";
import { recordCall } from "../../telemetry/telemetry";
import { recordCallAndAuditDecision, recordCallAndAuditProviderError } from "../../telemetry/helpers";
import { getRuntimeContext } from "../../core/state";
import { getCallerContext } from "../../security/auth";
import { detectDrift } from "../../security/drift";
import { queueAuditEvent } from "../../util/webhook";
import { extractBearerToken, extractParams, selectRouteNameByModel, sendError, mapDecisionReason, mapPolicyReasonToErrorKey, sendOpenAIError } from "../openaiUtil";
import { mergeParams, enforceMaxTokens, validateParams } from "../../providers/params";
import { log, LogLevel } from "../../util/log";

interface InvokeBody {
  // OpenAI chat completions
  readonly model?: string;
  readonly messages?: Array<{ role: string; content: string }>;

  // Common parameters (override route defaults)
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
  readonly frequency_penalty?: number;
  readonly presence_penalty?: number;
  readonly stop?: string[];
  readonly top_k?: number;
  readonly stop_sequences?: string[];
  readonly stream?: boolean;

  // Provider-specific passthrough
  readonly [key: string]: unknown;
}

export function registerInvokeRoutes(app: FastifyInstance): void {
  app.post<{ Body: InvokeBody }>("/v1/chat/completions", async (request: FastifyRequest, reply: FastifyReply) => {
    const requestStartMs: number = Date.now();
    const body = request.body as InvokeBody | null | undefined;

    if (body == null) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=chat_completions reason=invalid_json`);
      return sendError(reply, "invalid_json");
    }

    const token = extractBearerToken(String(request.headers["authorization"] ?? ""));
    if (!token) {
      // prettier-ignore
      log(LogLevel.warn, `request_unauthorized endpoint=chat_completions reason=missing_api_key`);
      return sendError(reply, "invalid_parapet_api_key");
    }

    if (typeof body.model !== "string" || body.model.trim().length === 0) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=chat_completions reason=invalid_body missing=model`);
      return sendError(reply, "invalid_body");
    }

    const rt = getRuntimeContext();
    const caller = getCallerContext(token);
    if (!caller) {
      // prettier-ignore
      log(LogLevel.warn, `request_unauthorized endpoint=chat_completions reason=invalid_parapet_api_key`);
      return sendError(reply, "invalid_parapet_api_key");
    }

    const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model, rt, "chat_completions");
    if (!routeName) {
      // prettier-ignore
      log(LogLevel.warn, `policy_block endpoint=chat_completions tenant=${caller.tenant} reason=drift_violation model=${body.model}`);
      // drift_strict: requested model not approved for any allowed route
      return sendError(reply, "drift_violation");
    }

    const route = rt.routeByName.get(routeName);
    if (!route) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=chat_completions tenant=${caller.tenant} reason=unknown_route route=${routeName}`);
      return sendError(reply, "unknown_route");
    }

    const tenantName = caller.tenant;

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      recordCallAndAuditDecision(rt, {
        tenant: tenantName,
        routeName: route.name,
        serviceLabel: caller.serviceLabel,
        allowed: false,
        reasonIfBlocked: "invalid_body",
        estCostUsd: 0,
      });
      
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=chat_completions tenant=${tenantName} route=${route.name} reason=invalid_body missing=messages`);
      return sendError(reply, "invalid_body");
    }

    const policyInput: PolicyInput = {
      messages: body.messages,
      params: extractParams(body as Record<string, unknown>, ["messages", "model", "stream"]),
    };

    const decision = await evaluatePolicy(token, routeName, policyInput);

    const serviceLabel = caller.serviceLabel;

    if (!decision.allowed) {
      recordCallAndAuditDecision(rt, {
        tenant: tenantName,
        routeName: route.name,
        serviceLabel,
        allowed: false,
        reasonIfBlocked: mapDecisionReason(decision.reason),
        estCostUsd: 0,
      });
      // prettier-ignore
      log(LogLevel.info, `policy_block endpoint=chat_completions tenant=${tenantName} route=${route.name} reason=${mapDecisionReason(decision.reason)}`);
      return sendError(reply, mapPolicyReasonToErrorKey(decision.reason));
    }

    const endpointType = route.provider.endpoint_type ?? "chat_completions";
    let mergedParams = mergeParams(route.provider.default_params, policyInput.params ?? {});
    mergedParams = enforceMaxTokens(mergedParams, route.policy.max_tokens_out, endpointType);
    const validation = validateParams(route.provider.type, endpointType, mergedParams);
    if (!validation.valid) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=chat_completions tenant=${tenantName} route=${route.name} reason=invalid_body detail=${validation.error ?? "invalid parameters"}`);
      recordCallAndAuditDecision(rt, {
        tenant: tenantName,
        routeName: route.name,
        serviceLabel,
        allowed: false,
        reasonIfBlocked: "invalid_parameters",
        estCostUsd: 0,
      });
      return sendOpenAIError(reply, 400, `Invalid parameters: ${validation.error ?? "invalid parameters"}`, "invalid_request_error", "invalid_body");
    }

    try {
      const providerInput = {
        messages: decision.sanitizedMessages,
        input: decision.sanitizedInput,
        params: policyInput.params ?? {},
        stream: body.stream,
      } as const;

      const providerResult = await callRouteProvider(route, providerInput);
      const driftResult = detectDrift(
        route,
        route.provider.model,
        providerResult.finalCostUsd,
        decision.estCostUsd,
        providerResult.metadata
      );

      if (providerResult.stream) {
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const reader = providerResult.stream.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            reply.raw.write(chunk);
          }
        } finally {
          reader.releaseLock();
          reply.raw.end();
        }

        // Finalize budget and record call
        finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, providerResult.finalCostUsd);
        recordCallAndAuditDecision(rt, {
          tenant: decision.routeMeta.tenant,
          routeName: route.name,
          serviceLabel,
          allowed: true,
          redactionApplied: decision.redactionApplied,
          budgetBeforeUsd: decision.budgetBeforeUsd,
          estCostUsd: decision.estCostUsd,
          finalCostUsd: providerResult.finalCostUsd,
          tokensIn: providerResult.tokensIn,
          tokensOut: providerResult.tokensOut,
          latencyMs: providerResult.latencyMs,
          messagesForSnippet: decision.sanitizedMessages,
          includePromptSnippet: route.webhook?.include_prompt_snippet === true,
          responseModel: providerResult.metadata?.model !== route.provider.model ? providerResult.metadata?.model : undefined,
          systemFingerprint: providerResult.metadata?.systemFingerprint,
          driftDetected: driftResult.detected,
          driftReason: driftResult.reason,
        });
        const totalLatencyMs: number = Date.now() - requestStartMs;
        // prettier-ignore
        log(
          LogLevel.info,
          `request_ok endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=${providerResult.latencyMs} est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=${providerResult.finalCostUsd.toFixed(6)} tokens_in=${providerResult.tokensIn} tokens_out=${providerResult.tokensOut}`
        );
        return;
      }

      finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, providerResult.finalCostUsd);
      recordCallAndAuditDecision(rt, {
        tenant: decision.routeMeta.tenant,
        routeName: route.name,
        serviceLabel,
        allowed: true,
        redactionApplied: decision.redactionApplied,
        budgetBeforeUsd: decision.budgetBeforeUsd,
        estCostUsd: decision.estCostUsd,
        finalCostUsd: providerResult.finalCostUsd,
        tokensIn: providerResult.tokensIn,
        tokensOut: providerResult.tokensOut,
        latencyMs: providerResult.latencyMs,
        messagesForSnippet: decision.sanitizedMessages,
        includePromptSnippet: route.webhook?.include_prompt_snippet === true,
        responseModel: providerResult.metadata?.model !== route.provider.model ? providerResult.metadata?.model : undefined,
        systemFingerprint: providerResult.metadata?.systemFingerprint,
        driftDetected: driftResult.detected,
        driftReason: driftResult.reason,
      });
      const totalLatencyMs: number = Date.now() - requestStartMs;
      // prettier-ignore
      log(
        LogLevel.info,
        `request_ok endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=${providerResult.latencyMs} est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=${providerResult.finalCostUsd.toFixed(6)} tokens_in=${providerResult.tokensIn} tokens_out=${providerResult.tokensOut}`
      );

      return reply.code(200).send(providerResult.output);
    } catch (err) {
      // Provider error telemetry + audit
      recordCallAndAuditProviderError(rt, {
        tenant: decision.routeMeta.tenant,
        routeName: route.name,
        serviceLabel,
        estCostUsd: decision.estCostUsd,
      });
      const e = err as any;
      if (e?.provider === "openai" && (e?.status === 401 || e?.code === "invalid_api_key")) {
        // prettier-ignore
        log(LogLevel.warn, `provider_error endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} reason=invalid_openai_api_key`);
        return sendError(reply, "invalid_openai_api_key", { routeName });
      }
      // prettier-ignore
      log(LogLevel.warn, `provider_error endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} reason=upstream_error provider=OpenAI status=${e?.status ?? "unknown"}`);
      return sendError(reply, "upstream_error", { providerName: "OpenAI", upstreamStatus: e?.status });
    }
  });
}
// prompt excerpt generation now handled in queueAuditEvent

