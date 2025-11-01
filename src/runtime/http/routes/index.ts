import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { APIResponse, InvokeResponse } from "@parapetai/parapet/runtime/core/types";
import { evaluatePolicy } from "@parapetai/parapet/runtime/policy/policy";
import { callRouteProvider } from "@parapetai/parapet/runtime/core/providerRouter";
import { finalize } from "@parapetai/parapet/runtime/policy/budget";
import { recordCall } from "@parapetai/parapet/runtime/telemetry/telemetry";
import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";
import { getCallerContext } from "@parapetai/parapet/runtime/security/auth";

interface InvokeBody {
  readonly prompt?: string;
}

interface InvokeHeaders {
  "x-parapet-service-key"?: string;
}

export function registerInvokeRoutes(app: FastifyInstance): void {
  app.post<{
    Params: { routeName: string };
    Body: InvokeBody;
    Headers: InvokeHeaders;
  }>("/:routeName", async (request: FastifyRequest, reply: FastifyReply) => {
    const routeName = (request.params as any).routeName as string;
    const token = String((request.headers as InvokeHeaders)["x-parapet-service-key"] ?? "");
    const body = request.body as InvokeBody | null | undefined;
    if (body === null) {
      const response: APIResponse = { statusCode: 400, error: "invalid_json" };
      return reply.code(response.statusCode).send(response);
    }
    const prompt = (body as InvokeBody | undefined)?.prompt ?? "";

    if (!prompt) {
      const response: APIResponse = { statusCode: 400, error: "invalid_body" };
      return reply.code(response.statusCode).send(response);
    }

    const decision = await evaluatePolicy(token, routeName, prompt);

    const rt = getRuntimeContext();
    const caller = getCallerContext(token);
    const serviceLabel = caller?.serviceLabel ?? "unknown";
    const tenantName = caller?.tenant ?? "unknown";

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

      const response: APIResponse = {
        statusCode: mapBlockReasonToStatus(decision.reason),
        error: decision.reason,
      };
      return reply.code(response.statusCode).send(response);
    }

    const route = rt.routeByName.get(decision.routeMeta.routeName);
    if (!route) {
      const response: APIResponse = { statusCode: 500, error: "route_not_found" };
      return reply.code(response.statusCode).send(response);
    }

    try {
      const providerResult = await callRouteProvider(route, decision.sanitizedPrompt, route.policy.max_tokens_out);
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
      });

      const response: APIResponse<InvokeResponse> = {
        statusCode: 200,
        data: { output: providerResult.output, decision },
      };
      return reply.code(response.statusCode).send(response);
    } catch {
      const response: APIResponse = { statusCode: 500, error: "provider_error" };
      return reply.code(response.statusCode).send(response);
    }
  });
}

function mapBlockReasonToStatus(reason: string): number {
  switch (reason) {
    case "unauthorized":
      return 401;
    case "not_allowed":
    case "tenant_mismatch":
      return 403;
    case "budget_exceeded":
      return 429;
    case "max_tokens_in_exceeded":
    case "drift_violation":
    case "redaction_blocked":
    default:
      return 400;
  }
}
 

