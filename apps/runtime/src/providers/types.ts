import type { ProviderName } from "@parapetai/config-core";

export type EndpointType = "chat_completions" | "embeddings";

export interface LlmCallInput {
  readonly endpointType: EndpointType;
  readonly model: string;
  readonly apiKey: string;
  readonly endpoint?: string; // custom endpoint override
  
  // Chat completions
  readonly messages: Array<{ role: string; content: string }>;
  
  // Embeddings
  readonly input?: string | string[];
  
  // All parameters
  readonly params: Readonly<Record<string, unknown>>;
  
  // Streaming
  readonly stream?: boolean;
}

export interface LlmCallOutput {
  readonly output: unknown; // raw provider response body
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly stream?: ReadableStream; // if streaming requested
  readonly metadata?: {
    readonly model?: string;
    readonly systemFingerprint?: string;
  };
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  callLLM(input: LlmCallInput): Promise<LlmCallOutput>;
}

