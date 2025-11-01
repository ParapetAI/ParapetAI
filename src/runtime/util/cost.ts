import type { ProviderType } from "@parapetai/parapet/config/spec/types";

export function estimateTokens(text: string): number {
  const chars = typeof text === "string" ? text.length : 0;
  // cheap heuristic: ~ 4 chars per token
  return Math.max(1, Math.round(chars / 4));
}

interface Price {
  readonly inPerTokUsd: number;
  readonly outPerTokUsd: number;
}

function getPrice(provider: ProviderType, _model: string): Price {
  switch (provider) {
    case "openai":
      return { inPerTokUsd: 0.000005, outPerTokUsd: 0.000015 };
    case "anthropic":
      return { inPerTokUsd: 0.000006, outPerTokUsd: 0.000013 };
    case "local":
    default:
      return { inPerTokUsd: 0.0, outPerTokUsd: 0.0 };
  }
}

export function estimateCost(provider: ProviderType, model: string, tokensIn: number, tokensOutGuess: number): number {
  const price = getPrice(provider, model);
  const cost = tokensIn * price.inPerTokUsd + tokensOutGuess * price.outPerTokUsd;
  return Math.max(0, Number(cost.toFixed(6)));
}

export function estimateCostCents(tokens: number): number {
  // Back-compat: assume openai in-rate for rough cents calc
  const usd = tokens * 0.000005;
  return Math.round(usd * 100);
}

