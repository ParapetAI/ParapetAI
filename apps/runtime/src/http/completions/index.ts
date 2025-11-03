import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { evaluatePolicy, type PolicyInput } from "../../policy/policy";
import { callRouteProvider } from "../../core/providerRouter";
import { finalize, getRouteSpendTodayUsd, getTenantSpendTodayUsd } from "../../policy/budget";
import { recordCall } from "../../telemetry/telemetry";
import { getRuntimeContext } from "../../core/state";
import { getCallerContext } from "../../security/auth";
import { detectDrift } from "../../security/drift";
import { queueAuditEvent } from "../../util/webhook";
import { extractBearerToken, extractParams, selectRouteNameByModel, sendError, mapDecisionReason, mapPolicyReasonToErrorKey } from "../openaiUtil";

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
    const body = request.body as InvokeBody | null | undefined;

    if (body == null) {
      return sendError(reply, "invalid_json");
    }

    const token = extractBearerToken(String(request.headers["authorization"] ?? ""));
    if (!token) {
      return sendError(reply, "invalid_parapet_api_key");
    }

    if (typeof body.model !== "string" || body.model.trim().length === 0) {
      return sendError(reply, "invalid_body");
    }

    const rt = getRuntimeContext();
    const caller = getCallerContext(token);
    if (!caller) {
      return sendError(reply, "invalid_parapet_api_key");
    }

    const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model, rt, "chat_completions");
    if (!routeName) {
      // drift_strict: requested model not approved for any allowed route
      return sendError(reply, "drift_violation");
    }

    const route = rt.routeByName.get(routeName);
    if (!route) {
      return sendError(reply, "unknown_route");
    }

    const tenantName = caller.tenant;

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      queueAuditEvent(rt, route.name, "request_error", {
        tenant: tenantName,
        decision: "block",
        reason_if_blocked: "invalid_body",
      });
      return sendError(reply, "invalid_body");
    }

    const policyInput: PolicyInput = {
      messages: body.messages,
      params: extractParams(body as Record<string, unknown>, ["messages", "model"]),
    };

    const decision = await evaluatePolicy(token, routeName, policyInput);

    const serviceLabel = caller.serviceLabel;

    if (!decision.allowed) {
      // Record call
      recordCall({
        ts: Date.now(),
        tenant: tenantName,
        route: routeName,
        service_label: serviceLabel,
        allowed: false,
        block_reason: decision.reason,
        redaction_applied: false,
        drift_strict: false,
        budget_before_usd: 0,
        est_cost_usd: 0,
        checksum_config: rt.checksum,
      });

      // Emit policy decision block event
      queueAuditEvent(rt, route.name, "policy_decision", {
        tenant: tenantName,
        decision: "block",
        reason_if_blocked: mapDecisionReason(decision.reason),
      });
      return sendError(reply, mapPolicyReasonToErrorKey(decision.reason));
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
        recordCall({
          ts: Date.now(),
          tenant: decision.routeMeta.tenant,
          route: route.name,
          service_label: serviceLabel,
          allowed: true,
          redaction_applied: decision.redactionApplied,
          drift_strict: decision.driftStrict,
          budget_before_usd: decision.budgetBeforeUsd,
          est_cost_usd: decision.estCostUsd,
          final_cost_usd: providerResult.finalCostUsd,
          tokens_in: providerResult.tokensIn,
          tokens_out: providerResult.tokensOut,
          latency_ms: providerResult.latencyMs,
          checksum_config: rt.checksum,
          drift_detected: driftResult.detected,
          drift_reason: driftResult.reason,
          response_model: providerResult.metadata?.model !== route.provider.model ? providerResult.metadata?.model : undefined,
          system_fingerprint: providerResult.metadata?.systemFingerprint,
        });

        // Emit allow event
        queueAuditEvent(rt, route.name, "policy_decision", {
          tenant: decision.routeMeta.tenant,
          decision: "allow",
          estimated_cost_usd: decision.estCostUsd,
          actual_cost_usd: providerResult.finalCostUsd,
          include_prompt_snippet: route.webhook?.include_prompt_snippet === true,
          messages: decision.sanitizedMessages,
        });
        return;
      }

      finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, providerResult.finalCostUsd);
      recordCall({
        ts: Date.now(),
        tenant: decision.routeMeta.tenant,
        route: route.name,
        service_label: serviceLabel,
        allowed: true,
        redaction_applied: decision.redactionApplied,
        drift_strict: decision.driftStrict,
        budget_before_usd: decision.budgetBeforeUsd,
        est_cost_usd: decision.estCostUsd,
        final_cost_usd: providerResult.finalCostUsd,
        tokens_in: providerResult.tokensIn,
        tokens_out: providerResult.tokensOut,
        latency_ms: providerResult.latencyMs,
        checksum_config: rt.checksum,
        drift_detected: driftResult.detected,
        drift_reason: driftResult.reason,
        response_model: providerResult.metadata?.model !== route.provider.model ? providerResult.metadata?.model : undefined,
        system_fingerprint: providerResult.metadata?.systemFingerprint,
      });
      // Emit allow event
      queueAuditEvent(rt, route.name, "policy_decision", {
        tenant: decision.routeMeta.tenant,
        decision: "allow",
        estimated_cost_usd: decision.estCostUsd,
        actual_cost_usd: providerResult.finalCostUsd,
        include_prompt_snippet: route.webhook?.include_prompt_snippet === true,
        messages: decision.sanitizedMessages,
      });

      return reply.code(200).send(providerResult.output);
    } catch (err) {
      // Provider error event
      queueAuditEvent(rt, route.name, "provider_error", {
        tenant: decision.routeMeta.tenant,
        decision: "block",
        reason_if_blocked: "server_error",
        estimated_cost_usd: decision.estCostUsd,
        actual_cost_usd: 0,
      });
      const e = err as any;
      if (e?.provider === "openai" && (e?.status === 401 || e?.code === "invalid_api_key")) {
        return sendError(reply, "invalid_openai_api_key", { routeName });
      }
      return sendError(reply, "upstream_error", { providerName: "OpenAI", upstreamStatus: e?.status });
    }
  });
}
// prompt excerpt generation now handled in queueAuditEvent

