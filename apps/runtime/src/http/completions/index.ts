import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { HydratedRoute } from "@parapetai/config-core";
import { evaluatePolicy, type PolicyInput } from "../../policy/policy";
import { callRouteProvider } from "../../core/providerRouter";
import { finalize } from "../../policy/budget";
import { recordCallAndAuditDecision, recordCallAndAuditProviderError } from "../../telemetry/helpers";
import { getRuntimeContext } from "../../core/state";
import { getCallerContext } from "../../security/auth";
import { detectDrift } from "../../security/drift";
import { extractBearerToken, extractParams, selectRouteNameByModel, sendError, mapDecisionReason, mapPolicyReasonToErrorKey, sendOpenAIError } from "../openaiUtil";
import { mergeParams, enforceMaxTokens, validateParams } from "../../providers/params";
import { log, LogLevel } from "../../util/log";
import { computeDelayMs, sleep } from "../../util/backoff";
import { buildCacheKey } from "../../util/cacheKey";

interface ProviderResultForStream {
  readonly stream?: ReadableStream;
  readonly finalCostUsd: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly metadata?: { readonly model?: string; readonly systemFingerprint?: string; readonly retryCount?: number };
}

interface RetriesConfig {
  readonly max_attempts: number;
  readonly base_ms: number;
  readonly jitter: boolean;
  readonly retry_on: readonly number[];
  readonly max_elapsed_ms: number;
}

async function pipeStreamWithRetries(
  route: HydratedRoute,
  providerInput: { readonly messages?: Array<{ role: string; content: string }>; readonly input?: string | string[]; readonly params: Readonly<Record<string, unknown>>; readonly stream?: boolean },
  initialResult: ProviderResultForStream,
  retries: RetriesConfig | undefined,
  writeChunk: (chunk: string) => void
): Promise<{ latestResult: ProviderResultForStream; retryCount: number; completed: boolean }> {
  const maxAttempts = Math.max(1, retries?.max_attempts ?? 1);
  const baseMs = retries?.base_ms ?? 0;
  const jitter = retries?.jitter ?? false;
  const start = Date.now();

  let attempt = 1;
  let latestResult: ProviderResultForStream = initialResult;
  let completed = false;

  while (attempt <= maxAttempts) {
    const reader = latestResult.stream!.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          completed = true;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        writeChunk(chunk);
      }
      break;
    } catch (e) {
      reader.releaseLock();
      if (!retries || attempt >= maxAttempts || Date.now() - start >= (retries?.max_elapsed_ms ?? 0)) {
        break;
      }
      const delay = computeDelayMs(attempt, baseMs, jitter);
      await sleep(delay);
      latestResult = await callRouteProvider(route as any, providerInput) as unknown as ProviderResultForStream;
      attempt += 1;
      continue;
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
  }

  return { latestResult, retryCount: attempt - 1, completed };
}

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
    mergedParams = enforceMaxTokens(mergedParams, route.policy?.max_tokens_out ?? 0, endpointType);
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
      const cachingEnabled: boolean = route.cache?.enabled === true;
      const shouldStream: boolean = Boolean(body.stream);
      const cacheEntry = getRuntimeContext().routeCacheByName?.get(route.name);

      if (cachingEnabled && !shouldStream && cacheEntry) {
        const includeParams: boolean = route.cache?.include_params !== false;
        const key = buildCacheKey(
          route,
          endpointType,
          { messages: decision.sanitizedMessages! },
          mergedParams,
          includeParams,
          route.policy?.redaction.mode ?? "off"
        );
        const hit = cacheEntry.lru.get(key) as { status: number; body: unknown } | undefined;
        if (hit) {
          cacheEntry.stats.hits += 1;

          // release reservation since no provider call happens
          if (route.policy) 
            finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, 0);

          const totalLatencyMs: number = Date.now() - requestStartMs;
          recordCallAndAuditDecision(rt, {
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
            messagesForSnippet: decision.sanitizedMessages,
            includePromptSnippet: route.webhook?.include_prompt_snippet === true,
            cacheHit: true,
          });

          // prettier-ignore
          log(LogLevel.info, `request_ok endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=0 est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=0 tokens_in=0 tokens_out=0 cache_enabled=true cache_hit=true cache_size=${cacheEntry.lru.size} cache_hits_total=${cacheEntry.stats.hits} cache_misses_total=${cacheEntry.stats.misses} cache_evictions_total=${cacheEntry.stats.evictions}`);
          return reply.code(hit.status).send(hit.body);
        } else {
          cacheEntry.stats.misses += 1;
        }
      }

      const providerInput = {
        messages: decision.sanitizedMessages,
        input: decision.sanitizedInput,
        params: policyInput.params ?? {},
        stream: body.stream,
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

      if (providerResult.stream) {
        reply.hijack();
        try {
          reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          const retries = route.retries;
          const { latestResult, retryCount, completed } = await pipeStreamWithRetries(
            route,
            providerInput,
            providerResult,
            retries,
            (chunk) => {
              try {
                reply.raw.write(chunk);
              } catch (writeErr) {
                // prettier-ignore
                log(LogLevel.warn, `stream_write_error endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} error=${(writeErr as Error).message}`);
              }
            }
          );

          reply.raw.end();

          if (route.policy) finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, latestResult.finalCostUsd);
          recordCallAndAuditDecision(rt, {
            tenant: decision.routeMeta.tenant,
            routeName: route.name,
            serviceLabel,
            allowed: completed,
            redactionApplied: decision.redactionApplied,
            budgetBeforeUsd: decision.budgetBeforeUsd,
            estCostUsd: decision.estCostUsd,
            finalCostUsd: latestResult.finalCostUsd,
            tokensIn: latestResult.tokensIn,
            tokensOut: latestResult.tokensOut,
            latencyMs: latestResult.latencyMs,
            messagesForSnippet: decision.sanitizedMessages,
            includePromptSnippet: route.webhook?.include_prompt_snippet === true,
            responseModel: latestResult.metadata?.model !== route.provider.model ? latestResult.metadata?.model : undefined,
            systemFingerprint: latestResult.metadata?.systemFingerprint,
            driftDetected: driftResult.detected,
            driftReason: driftResult.reason,
            retryCount,
          });
          const totalLatencyMs: number = Date.now() - requestStartMs;
          // prettier-ignore
          log(LogLevel.info, `request_ok endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=${providerResult.latencyMs} est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=${providerResult.finalCostUsd.toFixed(6)} tokens_in=${providerResult.tokensIn} tokens_out=${providerResult.tokensOut} cache_enabled=${route.cache?.enabled === true} cache_hit=false`);
          return;
        } catch (streamErr) {
          // prettier-ignore
          log(LogLevel.error, `stream_error endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} error=${(streamErr as Error).message}`);
          try {
            reply.raw.end();
          } catch {
            // ignore
          }
          return;
        }
      }

      if (route.policy) finalize(decision.routeMeta.tenant, route.name, decision.estCostUsd, providerResult.finalCostUsd);
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
        retryCount: providerResult.metadata?.retryCount,
      });

      const totalLatencyMs: number = Date.now() - requestStartMs;

      // prettier-ignore
      log(LogLevel.info, `request_ok endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} service=${serviceLabel} model=${route.provider.model} http_latency_ms=${totalLatencyMs} provider_latency_ms=${providerResult.latencyMs} est_cost_usd=${decision.estCostUsd.toFixed(6)} final_cost_usd=${providerResult.finalCostUsd.toFixed(6)} tokens_in=${providerResult.tokensIn} tokens_out=${providerResult.tokensOut} cache_enabled=${route.cache?.enabled === true} cache_hit=false${route.cache?.enabled ? ` cache_size=${getRuntimeContext().routeCacheByName?.get(route.name)?.lru.size ?? 0} cache_hits_total=${getRuntimeContext().routeCacheByName?.get(route.name)?.stats.hits ?? 0} cache_misses_total=${getRuntimeContext().routeCacheByName?.get(route.name)?.stats.misses ?? 0} cache_evictions_total=${getRuntimeContext().routeCacheByName?.get(route.name)?.stats.evictions ?? 0}` : ""}`);

      // Cache store (non-streaming only)
      if (route.cache?.enabled && !body.stream) {
        const includeParams: boolean = route.cache?.include_params !== false;
        const key = buildCacheKey(
          route,
          endpointType,
          { messages: decision.sanitizedMessages! },
          mergedParams,
          includeParams,
          route.policy?.redaction.mode ?? "off"
        );
        const entry = getRuntimeContext().routeCacheByName?.get(route.name);
        if (entry) {
          const had = entry.lru.has(key);
          const sizeBefore = entry.lru.size;
          entry.lru.set(key, { status: 200, body: providerResult.output });
          const sizeAfter = entry.lru.size;
          if (!had && sizeAfter === sizeBefore) {
            entry.stats.evictions += 1;
          }
        }
      }

      return reply.code(200).send(providerResult.output);
    } catch (err) {
      // Provider error telemetry + audit
      recordCallAndAuditProviderError(rt, {
        tenant: decision.routeMeta.tenant,
        routeName: route.name,
        serviceLabel,
        estCostUsd: decision.estCostUsd,
        retryCount: (err as any)?.metadata?.retryCount ?? undefined,
      });

      const e = err as any;
      if (e?.provider === "openai" && (e?.status === 401 || e?.code === "invalid_api_key")) {
        // prettier-ignore
        log(LogLevel.warn, `provider_error endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} reason=invalid_openai_api_key`);
        return sendError(reply, "invalid_openai_api_key", { routeName });
      }

      // prettier-ignore
      log(
        LogLevel.warn,
        `provider_error endpoint=chat_completions tenant=${decision.routeMeta.tenant} route=${route.name} reason=upstream_error provider=OpenAI status=${e?.status ?? "unknown"} code=${e?.code ?? "unknown"} error_type=${e?.errorType ?? "unknown"} message=${(e?.message ?? "").toString().replace(/\s+/g, " ").slice(0, 300)}`
      );
      return sendError(reply, "upstream_error", { providerName: "OpenAI", upstreamStatus: e?.status });
    }
  });
}
// prompt excerpt generation now handled in queueAuditEvent

