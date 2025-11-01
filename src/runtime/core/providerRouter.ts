import type { ProviderAdapter } from "@parapetai/parapet/providers/types";
import { openaiProvider } from "@parapetai/parapet/providers/openaiProvider";
import { anthropicProvider } from "@parapetai/parapet/providers/anthropicProvider";
import { localProvider } from "@parapetai/parapet/providers/localProvider";
import type { HydratedRoute } from "@parapetai/parapet/config/hydration/hydratedTypes";
import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";
import { estimateCost } from "@parapetai/parapet/runtime/util/cost";

const registry: Readonly<Record<string, ProviderAdapter>> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  local: localProvider,
};

export async function callRouteProvider(
  route: HydratedRoute,
  prompt: string,
  maxTokensOut: number
): Promise<{ output: string; tokensIn: number; tokensOut: number; latencyMs: number; finalCostUsd: number }> {
  const adapter = registry[route.provider.type];
  if (!adapter) throw new Error(`No adapter for provider: ${route.provider.type}`);
  const runtime = getRuntimeContext();
  const apiKey = runtime.vault.get(`route:${route.name}:provider_key`) ?? "";
  const endpoint = route.provider.endpoint;
  const result = await adapter.callLLM({ prompt, model: route.provider.model, apiKey, maxTokensOut, endpoint });
  const finalCostUsd = estimateCost(route.provider.type, route.provider.model, result.tokensIn, result.tokensOut);
  return { ...result, finalCostUsd } as const;
}
