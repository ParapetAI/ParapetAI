import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { evaluatePolicy, type PolicyInput } from "../../policy/policy";
import { callRouteProvider } from "../../core/providerRouter";
import { finalize } from "../../policy/budget";
import { recordCall } from "../../telemetry/telemetry";
import { getRuntimeContext } from "../../core/state";
import { getCallerContext } from "../../security/auth";
import { detectDrift } from "../../security/drift";
import { queueAuditEvent } from "../../util/webhook";
import { extractBearerToken, extractParams, selectRouteNameByModel, sendError, mapDecisionReason, mapPolicyReasonToErrorKey } from "../openaiUtil";

interface EmbeddingsBody {
  readonly model?: string;
  readonly input?: string | string[];
  readonly [key: string]: unknown;
}

export function registerEmbeddingRoutes(app: FastifyInstance): void {
  app.post<{ Body: EmbeddingsBody }>("/v1/embeddings", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as EmbeddingsBody | null | undefined;

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

    const hasValidInput = typeof body.input === "string" || (Array.isArray(body.input) && body.input.length > 0 && body.input.every((v) => typeof v === "string"));
    if (!hasValidInput) {
      const rt = getRuntimeContext();
      const caller = getCallerContext(token);

      if (!caller) {
        return sendError(reply, "invalid_parapet_api_key");
      }

      const tenant = caller.tenant ?? "";
      const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model!, rt, "embeddings") ?? "";
      
      if (routeName) {
        queueAuditEvent(rt, routeName, "request_error", {
          tenant: tenant,
          decision: "block",
          reason_if_blocked: "invalid_body",
        });
      }

      return sendError(reply, "invalid_body");
    }

    const rt = getRuntimeContext();
    const caller = getCallerContext(token);
    if (!caller) {
      return sendError(reply, "invalid_parapet_api_key");
    }

    const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model, rt, "embeddings");
    if (!routeName) {
      return sendError(reply, "drift_violation");
    }

    const route = rt.routeByName.get(routeName);
    if (!route) {
      return sendError(reply, "unknown_route");
    }

    const tenantName = caller.tenant;

    const policyInput: PolicyInput = {
      input: body.input,
      params: extractParams(body as Record<string, unknown>, ["input", "model"]),
    };

    const decision = await evaluatePolicy(token, routeName, policyInput);
    const serviceLabel = caller.serviceLabel;

    if (!decision.allowed) {
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

      queueAuditEvent(rt, route.name, "policy_decision", {
        tenant: tenantName,
        decision: "block",
        reason_if_blocked: mapDecisionReason(decision.reason),
      });
      return sendError(reply, mapPolicyReasonToErrorKey(decision.reason));
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

      queueAuditEvent(rt, route.name, "policy_decision", {
        tenant: decision.routeMeta.tenant,
        decision: "allow",
        estimated_cost_usd: decision.estCostUsd,
        actual_cost_usd: providerResult.finalCostUsd,
        include_prompt_snippet: false,
      });

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


