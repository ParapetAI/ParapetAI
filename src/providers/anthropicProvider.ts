import type { ProviderAdapter, LlmCallInput, LlmCallOutput } from "./types";
import { estimateTokens } from "@parapetai/parapet/runtime/util/cost";

export const anthropicProvider: ProviderAdapter = {
  name: "anthropic",
  async callLLM(input: LlmCallInput): Promise<LlmCallOutput> {
    const start = Date.now();
    const tokensIn = estimateTokens(input.prompt);
    const tokensOut = Math.max(1, Math.min(input.maxTokensOut, Math.floor(tokensIn * 0.2)));
    const latencyMs = Math.max(1, Date.now() - start);
    const output = `anthropic:${input.model}: ${input.prompt.slice(0, 80)}`;
    return { output, tokensIn, tokensOut, latencyMs } as const;
  },
};

