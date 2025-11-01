import type { ProviderName } from "../config/constants";

export interface LlmCallInput {
  readonly prompt: string;
  readonly model: string;
  readonly apiKey: string;
  readonly maxTokensOut: number;
}

export interface LlmCallOutput {
  readonly output: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  callLLM(input: LlmCallInput): Promise<LlmCallOutput>;
}

