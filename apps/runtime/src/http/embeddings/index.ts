import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { evaluatePolicy, type PolicyInput } from "../../policy/policy";
import { callRouteProvider } from "../../core/providerRouter";
import { finalize, getTenantSpendTodayUsd } from "../../policy/budget";
import { recordCall } from "../../telemetry/telemetry";
import { recordCallAndAuditDecision, recordCallAndAuditProviderError } from "../../telemetry/helpers";
import { getRuntimeContext } from "../../core/state";
import { getCallerContext } from "../../security/auth";
import { detectDrift } from "../../security/drift";
import { queueAuditEvent } from "../../util/webhook";
import { extractBearerToken, extractParams, selectRouteNameByModel, sendError, mapDecisionReason, mapPolicyReasonToErrorKey, sendOpenAIError } from "../openaiUtil";
import { mergeParams, enforceMaxTokens, validateParams } from "../../providers/params";
import { log, LogLevel } from "../../util/log";

interface EmbeddingsBody {
  readonly model?: string;
  readonly input?: string | string[];
  readonly [key: string]: unknown;
}

export function registerEmbeddingRoutes(app: FastifyInstance): void {
  app.post<{ Body: EmbeddingsBody }>("/v1/embeddings", async (request: FastifyRequest, reply: FastifyReply) => {
    const requestStartMs: number = Date.now();
    const body = request.body as EmbeddingsBody | null | undefined;

    if (body == null) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=embeddings reason=invalid_json`);
      return sendError(reply, "invalid_json");
    }

    const token = extractBearerToken(String(request.headers["authorization"] ?? ""));
    if (!token) {
      // prettier-ignore
      log(LogLevel.warn, `request_unauthorized endpoint=embeddings reason=missing_api_key`);
      return sendError(reply, "invalid_parapet_api_key");
    }

    if (typeof body.model !== "string" || body.model.trim().length === 0) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=embeddings reason=invalid_body missing=model`);
      return sendError(reply, "invalid_body");
    }

    const hasValidInput = typeof body.input === "string" || (Array.isArray(body.input) && body.input.length > 0 && body.input.every((v) => typeof v === "string"));
    if (!hasValidInput) {
      const rt = getRuntimeContext();
      const caller = getCallerContext(token);

      if (!caller) {
        // prettier-ignore
        log(LogLevel.warn, `request_unauthorized endpoint=embeddings reason=invalid_parapet_api_key`);
        return sendError(reply, "invalid_parapet_api_key");
      }

      const tenant = caller.tenant ?? "";
      const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model!, rt, "embeddings") ?? "";
      
      if (routeName) {
        recordCallAndAuditDecision(rt, {
          tenant: tenant,
          allowed: false,
          routeName: routeName,
          serviceLabel: caller.serviceLabel,
          reasonIfBlocked: "invalid_body",
          estCostUsd: 0,
        });
      }

      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=embeddings tenant=${tenant} route=${routeName || "unknown"} reason=invalid_body missing=input`);
      return sendError(reply, "invalid_body");
    }

    const rt = getRuntimeContext();
    const caller = getCallerContext(token);
    if (!caller) {
      // prettier-ignore
      log(LogLevel.warn, `request_unauthorized endpoint=embeddings reason=invalid_parapet_api_key`);
      return sendError(reply, "invalid_parapet_api_key");
    }

    const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model, rt, "embeddings");
    if (!routeName) {
      // prettier-ignore
      log(LogLevel.warn, `policy_block endpoint=embeddings tenant=${caller.tenant} reason=drift_violation model=${body.model}`);
      return sendError(reply, "drift_violation");
    }

    const route = rt.routeByName.get(routeName);
    if (!route) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=embeddings tenant=${caller.tenant} reason=unknown_route route=${routeName}`);
      return sendError(reply, "unknown_route");
    }

    const tenantName = caller.tenant;

    const policyInput: PolicyInput = {
      input: body.input,
      params: extractParams(body as Record<string, unknown>, ["input", "model", "stream"]),
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
      log(LogLevel.info, `policy_block endpoint=embeddings tenant=${tenantName} route=${route.name} reason=${mapDecisionReason(decision.reason)}`);
      return sendError(reply, mapPolicyReasonToErrorKey(decision.reason));
    }

    const endpointType = route.provider.endpoint_type ?? "embeddings";
    let mergedParams = mergeParams(route.provider.default_params, policyInput.params ?? {});
    mergedParams = enforceMaxTokens(mergedParams, route.policy.max_tokens_out, endpointType);
    const validation = validateParams(route.provider.type, endpointType, mergedParams);
    if (!validation.valid) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=embeddings tenant=${tenantName} route=${route.name} reason=invalid_body detail=${validation.error ?? "invalid parameters"}`);
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
        input: decision.sanitizedInput,
        params: policyInput.params ?? {},
        stream: false,
      } as const;

      const providerResult = await callRouteProvider(route, providerInput);
      const driftResult = detectDrift(
        route,
        route.provider.model,
        providerResult.finalCostUsd,
        decision.estCostUsd,
        providerResult.metadata
      );

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
        includePromptSnippet: false,
        responseModel: providerResult.metadata?.model !== route.provider.model ? providerResult.metadata?.model : undefined,
        systemFingerprint: providerResult.metadata?.systemFingerprint,
        driftDetected: driftResult.detected,
        driftReason: driftResult.reason,
      });

    const totalLatencyMs: number = Date.now() - requestStartMs;
    // prettier-ignore
    log(
      LogLevel.info,
      `request_ok endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=${providerResult.latencyMs} est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=${providerResult.finalCostUsd.toFixed(6)} tokens_in=${providerResult.tokensIn} tokens_out=${providerResult.tokensOut}`
    );

      const vectors = Array.isArray(providerResult.output) ? (providerResult.output as number[][]) : [];
      const responseBody = {
        object: "list",
        data: vectors.map((embedding, index) => ({ object: "embedding", embedding, index })),
        model: providerResult.metadata?.model ?? route.provider.model,
        usage: {
          prompt_tokens: providerResult.tokensIn,
          total_tokens: providerResult.tokensIn,
        },
      } as const;

      return reply.code(200).send(responseBody);
    } catch (err) {
      recordCallAndAuditProviderError(rt, {
        tenant: decision.routeMeta.tenant,
        routeName: route.name,
        serviceLabel,
        estCostUsd: decision.estCostUsd,
      });
      const e = err as any;
      if (e?.provider === "openai" && (e?.status === 401 || e?.code === "invalid_api_key")) {
        // prettier-ignore
        log(LogLevel.warn, `provider_error endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} reason=invalid_openai_api_key`);
        return sendError(reply, "invalid_openai_api_key", { routeName });
      }
      // prettier-ignore
      log(LogLevel.warn, `provider_error endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} reason=upstream_error provider=OpenAI status=${e?.status ?? "unknown"}`);
      return sendError(reply, "upstream_error", { providerName: "OpenAI", upstreamStatus: e?.status });
    }
  });
}


