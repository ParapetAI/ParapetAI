import type { ProviderAdapter } from "@parapetai/parapet/providers/types";
import { openaiProvider } from "@parapetai/parapet/providers/openaiProvider";
import { anthropicProvider } from "@parapetai/parapet/providers/anthropicProvider";
import { localProvider } from "@parapetai/parapet/providers/localProvider";
import type { HydratedRoute } from "@parapetai/parapet/config/hydration/hydratedTypes";
import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";
import { estimateCost } from "@parapetai/parapet/runtime/util/cost";
import { mergeParams, validateParams, enforceMaxTokens } from "@parapetai/parapet/providers/params";
import type { EndpointType } from "@parapetai/parapet/providers/types";

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
    throw new Error(`Invalid parameters: ${validation.error}`);
  }
  
  const llmInput: import("@parapetai/parapet/providers/types").LlmCallInput = {
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
  return { ...result, finalCostUsd } as const;
}

const registry: Readonly<Record<string, ProviderAdapter>> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  local: localProvider,
};
