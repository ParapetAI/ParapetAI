import type { ProviderAdapter, LlmCallInput, LlmCallOutput } from "./types";
import { estimateTokens } from "@parapetai/parapet/runtime/util/cost";

interface AnthropicResponse {
  model?: string;
  content?: Array<{ text: string; type: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    message: string;
    type: string;
  };
}

interface AnthropicSSEChunk {
  type: string;
  model?: string;
  delta?: { text?: string };
  message?: AnthropicResponse;
  content_block?: { text?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
}

function buildAnthropicUrl(endpoint: string | undefined): string {
  if (endpoint) return endpoint;
  return "https://api.anthropic.com/v1/messages";
}

function parseAnthropicSSE(line: string): AnthropicSSEChunk | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6);
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as AnthropicSSEChunk;
  } catch {
    return null;
  }
}

export const anthropicProvider: ProviderAdapter = {
  name: "anthropic",
  async callLLM(input: LlmCallInput): Promise<LlmCallOutput> {
    if (input.endpointType !== "chat_completions") {
      throw new Error("Anthropic provider only supports chat_completions endpoint");
    }

    const start = Date.now();
    const url = buildAnthropicUrl(input.endpoint);

    const requestBody: Record<string, unknown> = {
      model: input.model,
      messages: input.messages,
      max_tokens: input.params.max_tokens ?? 4096,
      ...input.params,
    };

    if (input.params.stop) {
      requestBody.stop_sequences = input.params.stop;
      delete requestBody.stop;
    }

    if (input.stream) {
      requestBody.stream = true;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as AnthropicResponse;
      throw new Error(errorData.error?.message ?? `Anthropic API error: ${response.status} ${response.statusText}`);
    }

    if (input.stream) {
      let responseModel: string | undefined;
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          const decoder = new TextDecoder();
          let buffer = "";
          let tokensIn = 0;
          let tokensOut = 0;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (line.trim() === "") continue;
                const chunk = parseAnthropicSSE(line);
                if (!chunk) continue;

                if (chunk.model) responseModel = chunk.model;
                
                if (chunk.type === "message_start" && chunk.message) {
                  if (chunk.message.model) responseModel = chunk.message.model;
                  if (chunk.message.usage) {
                    tokensIn = chunk.message.usage.input_tokens ?? tokensIn;
                  }
                }

                if (chunk.type === "message_delta" && chunk.usage) {
                  tokensOut = chunk.usage.output_tokens ?? tokensOut;
                }

                if (chunk.type === "content_block_delta" && chunk.delta?.text) {
                  const sseLine = `data: ${JSON.stringify(chunk)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseLine));
                }
              }
            }

            if (buffer.trim()) {
              const chunk = parseAnthropicSSE(`data: ${buffer}`);
              if (chunk) {
                if (chunk.model) responseModel = chunk.model;
                const sseLine = `data: ${JSON.stringify(chunk)}\n\n`;
                controller.enqueue(new TextEncoder().encode(sseLine));
              }
            }

            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          } catch (error) {
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      });

      const latencyMs = Math.max(1, Date.now() - start);
      const estimatedTokensIn = estimateTokens(input.messages.map((m) => m.content).join("\n"));
      const estimatedTokensOut = Math.max(1, Math.floor(estimatedTokensIn * 0.2));

      return {
        output: "",
        tokensIn: estimatedTokensIn,
        tokensOut: estimatedTokensOut,
        latencyMs,
        stream,
        metadata: responseModel ? { model: responseModel } : undefined,
      };
    }

    const data = (await response.json()) as AnthropicResponse;

    if (data.error) {
      throw new Error(data.error.message ?? "Anthropic API error");
    }

    const tokensIn = data.usage?.input_tokens ?? estimateTokens(input.messages.map((m) => m.content).join("\n"));
    const tokensOut = data.usage?.output_tokens ?? Math.max(1, Math.floor(tokensIn * 0.2));
    const latencyMs = Math.max(1, Date.now() - start);

    return {
      output: data,
      tokensIn,
      tokensOut,
      latencyMs,
      metadata: data.model ? { model: data.model } : undefined,
    } as const;
  },
};
