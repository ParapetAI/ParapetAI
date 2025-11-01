import type { ProviderType } from "@parapetai/parapet/config/spec/types";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function countSpecialChars(text: string): number {
  return (text.match(/[^\w\s]/g) ?? []).length;
}

export function estimateTokens(text: string): number {
  if (typeof text !== "string" || text.length === 0) return 1;
  
  const words = countWords(text);
  const chars = text.length;
  const specialChars = countSpecialChars(text);
  
  if (words === 0) {
    return Math.max(1, Math.round(chars / 3));
  }
  
  const avgCharsPerWord = chars / words;
  
  let tokensPerWord: number;
  if (avgCharsPerWord <= 3) {
    tokensPerWord = 0.75;
  } else if (avgCharsPerWord <= 5) {
    tokensPerWord = 1.0;
  } else if (avgCharsPerWord <= 7) {
    tokensPerWord = 1.25;
  } else if (avgCharsPerWord <= 10) {
    tokensPerWord = 1.5;
  } else {
    tokensPerWord = 2.0;
  }
  
  const wordTokens = words * tokensPerWord;
  const specialTokens = specialChars * 0.4;
  const whitespaceTokens = (text.match(/\s/g) ?? []).length * 0.08;
  
  return Math.max(1, Math.round(wordTokens + specialTokens + whitespaceTokens));
}

interface Price {
  readonly inPerTokUsd: number;
  readonly outPerTokUsd: number;
}

function getPrice(provider: ProviderType, model: string): Price {
  switch (provider) {
    case "openai": {
      const modelLower = model.toLowerCase();
      if (modelLower.includes("gpt-4o-mini")) {
        return { inPerTokUsd: 0.00000015, outPerTokUsd: 0.0000006 };
      }
      if (modelLower.includes("gpt-4o")) {
        return { inPerTokUsd: 0.0000025, outPerTokUsd: 0.00001 };
      }
      if (modelLower.includes("gpt-4-turbo")) {
        return { inPerTokUsd: 0.00001, outPerTokUsd: 0.00003 };
      }
      if (modelLower.includes("gpt-4") && !modelLower.includes("gpt-4o")) {
        return { inPerTokUsd: 0.00003, outPerTokUsd: 0.00006 };
      }
      if (modelLower.includes("gpt-3.5-turbo")) {
        return { inPerTokUsd: 0.0000005, outPerTokUsd: 0.0000015 };
      }
      if (modelLower.includes("text-embedding")) {
        if (modelLower.includes("3-large")) {
          return { inPerTokUsd: 0.00000013, outPerTokUsd: 0 };
        }
        if (modelLower.includes("3-small")) {
          return { inPerTokUsd: 0.00000002, outPerTokUsd: 0 };
        }
        return { inPerTokUsd: 0.0000001, outPerTokUsd: 0 };
      }
      return { inPerTokUsd: 0.0000005, outPerTokUsd: 0.0000015 };
    }
    case "anthropic": {
      const modelLower = model.toLowerCase();
      if (modelLower.includes("opus")) {
        return { inPerTokUsd: 0.000015, outPerTokUsd: 0.000075 };
      }
      if (modelLower.includes("sonnet")) {
        if (modelLower.includes("3.5") || modelLower.includes("4")) {
          return { inPerTokUsd: 0.000003, outPerTokUsd: 0.000015 };
        }
        return { inPerTokUsd: 0.000003, outPerTokUsd: 0.000015 };
      }
      if (modelLower.includes("haiku")) {
        if (modelLower.includes("3.5")) {
          return { inPerTokUsd: 0.0000008, outPerTokUsd: 0.000004 };
        }
        return { inPerTokUsd: 0.00000025, outPerTokUsd: 0.00000125 };
      }
      return { inPerTokUsd: 0.000003, outPerTokUsd: 0.000015 };
    }
    case "local":
      return { inPerTokUsd: 0, outPerTokUsd: 0 };
    default:
      return { inPerTokUsd: 0.0000005, outPerTokUsd: 0.0000015 };
  }
}

export function estimateCost(provider: ProviderType, model: string, tokensIn: number, tokensOutGuess: number): number {
  const price = getPrice(provider, model);
  const inMicros = Math.round(tokensIn * price.inPerTokUsd * 1_000_000);
  const outMicros = Math.round(tokensOutGuess * price.outPerTokUsd * 1_000_000);
  const totalMicros = Math.max(0, inMicros + outMicros);
  return totalMicros / 1_000_000;
}

export function estimateCostCents(tokens: number): number {
  const usd = tokens * 0.000005;
  return Math.round(usd * 100);
}

