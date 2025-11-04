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
import { buildCacheKey } from "../../util/cacheKey";

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

    const hasValidInput = typeof body.input === "string" || (Array.isArray(body.input) && body.input.length > 0 && body.input.every((item) => typeof item === "string"));
    if (!hasValidInput) {
      const runtimeContext = getRuntimeContext();
      const caller = getCallerContext(token);

      if (!caller) {
        // prettier-ignore
        log(LogLevel.warn, `request_unauthorized endpoint=embeddings reason=invalid_parapet_api_key`);
        return sendError(reply, "invalid_parapet_api_key");
      }

      const tenant = caller.tenant ?? "";
      const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model!, runtimeContext, "embeddings") ?? "";

      if (routeName) {
        recordCallAndAuditDecision(runtimeContext, {
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

    const runtimeContext = getRuntimeContext();
    const caller = getCallerContext(token);
    if (!caller) {
      // prettier-ignore
      log(LogLevel.warn, `request_unauthorized endpoint=embeddings reason=invalid_parapet_api_key`);
      return sendError(reply, "invalid_parapet_api_key");
    }

    const routeName = selectRouteNameByModel(caller.allowedRoutes, body.model, runtimeContext, "embeddings");
    if (!routeName) {
      // prettier-ignore
      log(LogLevel.warn, `policy_block endpoint=embeddings tenant=${caller.tenant} reason=drift_violation model=${body.model}`);
      return sendError(reply, "drift_violation");
    }

    const route = runtimeContext.routeByName.get(routeName);
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
      recordCallAndAuditDecision(runtimeContext, {
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
    mergedParams = enforceMaxTokens(mergedParams, route.policy?.max_tokens_out ?? 0, endpointType);
    const validation = validateParams(route.provider.type, endpointType, mergedParams);
    if (!validation.valid) {
      // prettier-ignore
      log(LogLevel.warn, `request_invalid endpoint=embeddings tenant=${tenantName} route=${route.name} reason=invalid_body detail=${validation.error ?? "invalid parameters"}`);
      recordCallAndAuditDecision(runtimeContext, {
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
      // Cache lookup (non-streaming)
      const cachingEnabled: boolean = route.cache?.enabled === true;
      const cacheEntry = getRuntimeContext().routeCacheByName?.get(route.name);

      if (cachingEnabled && cacheEntry) {
        const includeParams: boolean = route.cache?.include_params !== false;
        const key = buildCacheKey(
          route,
          endpointType,
          { input: decision.sanitizedInput as any },
          mergedParams,
          includeParams,
          route.policy?.redaction.mode ?? "off"
        );

        const hit = cacheEntry.lru.get(key) as { status: number; body: unknown } | undefined;

        if (hit) {
          cacheEntry.stats.hits += 1;
          if (route.policy)
            finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, 0);

          const totalLatencyMs: number = Date.now() - requestStartMs;
          recordCallAndAuditDecision(runtimeContext, {
            tenant: decision.routeMeta.tenant,
            routeName: route.name,
            serviceLabel,
            allowed: true,
            redactionApplied: decision.redactionApplied,
            budgetBeforeUsd: decision.budgetBeforeUsd,
            estCostUsd: decision.estCostUsd,
            finalCostUsd: 0,
            tokensIn: 0,
            tokensOut: 0,
            latencyMs: totalLatencyMs,
            includePromptSnippet: false,
            cacheHit: true,
          });
          // prettier-ignore
          log(LogLevel.info, `request_ok endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=0 est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=0 tokens_in=0 tokens_out=0 cache_enabled=true cache_hit=true cache_size=${cacheEntry.lru.size} cache_hits_total=${cacheEntry.stats.hits} cache_misses_total=${cacheEntry.stats.misses} cache_evictions_total=${cacheEntry.stats.evictions}`);
          return reply.code(hit.status).send(hit.body);
        } else {
          cacheEntry.stats.misses += 1;
        }
      }

      const providerInput = {
        input: decision.sanitizedInput,
        params: policyInput.params ?? {},
        stream: false,
      } as const;

      const providerResult = await callRouteProvider(route, providerInput);
      const driftResult = route.policy?.drift_detection.enabled
        ? detectDrift(
          route,
          route.provider.model,
          providerResult.finalCostUsd,
          decision.estCostUsd,
          providerResult.metadata
        )
        : { detected: false };

      if (route.policy)
        finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, providerResult.finalCostUsd);

      recordCallAndAuditDecision(runtimeContext, {
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
        retryCount: providerResult.metadata?.retryCount,
        includePromptSnippet: false,
        responseModel: providerResult.metadata?.model !== route.provider.model ? providerResult.metadata?.model : undefined,
        systemFingerprint: providerResult.metadata?.systemFingerprint,
        driftDetected: driftResult.detected,
        driftReason: driftResult.reason,
      });

      const totalLatencyMs: number = Date.now() - requestStartMs;

      // prettier-ignore
      log(LogLevel.info, `request_ok endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=${providerResult.latencyMs} est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=${providerResult.finalCostUsd.toFixed(6)} tokens_in=${providerResult.tokensIn} tokens_out=${providerResult.tokensOut} cache_enabled=${route.cache?.enabled === true} cache_hit=false${route.cache?.enabled ? ` cache_size=${getRuntimeContext().routeCacheByName?.get(route.name)?.lru.size ?? 0} cache_hits_total=${getRuntimeContext().routeCacheByName?.get(route.name)?.stats.hits ?? 0} cache_misses_total=${getRuntimeContext().routeCacheByName?.get(route.name)?.stats.misses ?? 0} cache_evictions_total=${getRuntimeContext().routeCacheByName?.get(route.name)?.stats.evictions ?? 0}` : ""}`);

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

      // Cache store
      if (route.cache?.enabled) {
        const includeParams: boolean = route.cache?.include_params !== false;
        const key = buildCacheKey(
          route,
          endpointType,
          { input: decision.sanitizedInput as any },
          mergedParams,
          includeParams,
          route.policy?.redaction.mode ?? "off"
        );
        const entry = getRuntimeContext().routeCacheByName?.get(route.name);

        if (entry) {
          const had = entry.lru.has(key);
          const sizeBefore = entry.lru.size;
          entry.lru.set(key, { status: 200, body: responseBody });
          const sizeAfter = entry.lru.size;
          if (!had && sizeAfter === sizeBefore) {
            entry.stats.evictions += 1;
          }
        }
      }

      return reply.code(200).send(responseBody);
    } catch (err) {
      recordCallAndAuditProviderError(runtimeContext, {
        tenant: decision.routeMeta.tenant,
        routeName: route.name,
        serviceLabel,
        estCostUsd: decision.estCostUsd,
      });

      const error = err as any;
      if (error?.provider === "openai" && (error?.status === 401 || error?.code === "invalid_api_key")) {
        // prettier-ignore
        log(LogLevel.warn, `provider_error endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} reason=invalid_openai_api_key`);
        return sendError(reply, "invalid_openai_api_key", { routeName });
      }

      // prettier-ignore
      log(LogLevel.warn, `provider_error endpoint=embeddings tenant=${decision.routeMeta.tenant} route=${route.name} reason=upstream_error provider=OpenAI status=${error?.status ?? "unknown"} code=${error?.code ?? "unknown"} error_type=${error?.errorType ?? "unknown"} message=${(error?.message ?? "").toString().replace(/\s+/g, " ").slice(0, 300)}`);
      
      return sendError(reply, "upstream_error", { providerName: "OpenAI", upstreamStatus: error?.status });
    }
  });
}


