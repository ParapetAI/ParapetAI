import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { APIResponse } from "@parapetai/parapet/runtime/core/types";
import { evaluatePolicy, type PolicyInput } from "@parapetai/parapet/runtime/policy/policy";
import { callRouteProvider } from "@parapetai/parapet/runtime/core/providerRouter";
import { finalize } from "@parapetai/parapet/runtime/policy/budget";
import { recordCall } from "@parapetai/parapet/runtime/telemetry/telemetry";
import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";
import { getCallerContext } from "@parapetai/parapet/runtime/security/auth";
import { detectDrift } from "@parapetai/parapet/runtime/security/drift";
import type { EndpointType } from "@parapetai/parapet/providers/types";

interface InvokeBody {
  // Chat completions
  readonly messages?: Array<{ role: string; content: string }>;
  
  // Embeddings
  readonly input?: string | string[];
  
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

    if (body == null) {
      const response: APIResponse = { statusCode: 400, error: "invalid_json" };
      return reply.code(response.statusCode).send(response);
    }

    const rt = getRuntimeContext();
    const route = rt.routeByName.get(routeName);
    if (!route) {
      const response: APIResponse = { statusCode: 404, error: "route_not_found" };
      return reply.code(response.statusCode).send(response);
    }

    const endpointType: EndpointType = route.provider.endpoint_type ?? "chat_completions";
    
    if (endpointType === "chat_completions" && (!body.messages || body.messages.length === 0)) {
      const response: APIResponse = { statusCode: 400, error: "invalid_body" };
      return reply.code(response.statusCode).send(response);
    }
    
    if (endpointType === "embeddings" && !body.input) {
      const response: APIResponse = { statusCode: 400, error: "invalid_body" };
      return reply.code(response.statusCode).send(response);
    }

    let policyInput: PolicyInput = {
      messages: body.messages,
      input: body.input,
      params: {},
    };

    const extractParams = (body: InvokeBody): Record<string, unknown> => {
      const params: Record<string, unknown> = {};
      const paramKeys = ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty", "stop", "top_k", "stop_sequences", "stream"];
      for (const key of paramKeys) {
        if (body[key] !== undefined) {
          params[key] = body[key];
        }
      }
      for (const [key, value] of Object.entries(body)) {
        if (!["messages", "input"].includes(key) && !paramKeys.includes(key)) {
          params[key] = value;
        }
      }
      return params;
    };

    policyInput.params = extractParams(body);

    const decision = await evaluatePolicy(token, routeName, policyInput);

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

    if (!route) {
      const response: APIResponse = { statusCode: 500, error: "route_not_found" };
      return reply.code(response.statusCode).send(response);
    }

    try {
      const providerInput = {
        messages: decision.sanitizedMessages,
        input: decision.sanitizedInput,
        params: policyInput.params,
        stream: body.stream,
      };

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

      return reply.code(200).send(providerResult.output);
    } catch (error) {
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
 

