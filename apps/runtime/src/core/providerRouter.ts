import { HydratedRoute, EndpointType } from "@parapetai/config-core";
import { localProvider } from "../providers/localProvider";
import { openaiProvider } from "../providers/openaiProvider";
import { mergeParams, enforceMaxTokens, validateParams } from "../providers/params";
import { LlmCallInput, ProviderAdapter } from "../providers/types";
import { estimateCost } from "../util/cost";
import { log, LogLevel } from "../util/log";
import { getRuntimeContext } from "./state";

export interface ProviderCallInput {
  readonly messages?: Array<{ role: string; content: string }>;
  readonly input?: string | string[];
  readonly params: Readonly<Record<string, unknown>>;
  readonly stream?: boolean;
}

export async function callRouteProvider(
  route: HydratedRoute,
  input: ProviderCallInput
): Promise<{ output: unknown; tokensIn: number; tokensOut: number; latencyMs: number; finalCostUsd: number; stream?: ReadableStream; metadata?: { model?: string; systemFingerprint?: string } }> {
  const adapter = registry[route.provider.type];
  if (!adapter) throw new Error(`No adapter for provider: ${route.provider.type}`);
  
  const runtime = getRuntimeContext();
  const apiKey = route.provider.provider_key ?? runtime.vault.get(`route:${route.name}:provider_key`) ?? "";
  const endpoint = route.provider.endpoint;
  const endpointType: EndpointType = route.provider.endpoint_type ?? "chat_completions";
  
  let mergedParams = mergeParams(route.provider.default_params, input.params);
  mergedParams = enforceMaxTokens(mergedParams, route.policy.max_tokens_out, endpointType);
  
  const validation = validateParams(route.provider.type, endpointType, mergedParams);
  if (!validation.valid) {
    throw new Error(`Invalid parameters: ${validation.error ?? "invalid parameters"}`);
  }
  
  const llmInput: LlmCallInput = {
    endpointType,
    model: route.provider.model,
    apiKey,
    endpoint,
    messages: input.messages ?? [],
    input: input.input,
    params: mergedParams,
    stream: input.stream,
  };
  
  const result = await adapter.callLLM(llmInput);
  const finalCostUsd = estimateCost(route.provider.type, route.provider.model, result.tokensIn, result.tokensOut);

  // prettier-ignore
  log(LogLevel.info, `provider_call route=${route.name} provider=${route.provider.type} model=${route.provider.model} endpoint=${endpointType} tokens_in=${result.tokensIn} tokens_out=${result.tokensOut} latency_ms=${result.latencyMs} final_cost_usd=${finalCostUsd.toFixed(6)} stream=${Boolean(result.stream)}`);
  return { ...result, finalCostUsd } as const;
}

const registry: Readonly<Record<string, ProviderAdapter>> = {
  openai: openaiProvider,
  local: localProvider,
};
