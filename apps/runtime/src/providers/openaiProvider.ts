import type { ProviderAdapter, LlmCallInput, LlmCallOutput } from "./types";
import { estimateTokens } from "../util/cost";
import { buildOpenAICompatibleUrl } from "./url";

interface OpenAIResponse {
  model?: string;
  system_fingerprint?: string;
  choices?: Array<{ message?: { content: string }; delta?: { content?: string } }>;
  data?: Array<{ embedding: number[]; index: number }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}


function parseSSEChunk(chunk: string): OpenAIResponse | null {
  if (!chunk.startsWith("data: ")) return null;
  const data = chunk.slice(6);
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as OpenAIResponse;
  } catch {
    return null;
  }
}

export const openaiProvider: ProviderAdapter = {
  name: "openai",
  async callLLM(input: LlmCallInput): Promise<LlmCallOutput> {
    if (!input.endpoint || input.endpoint.trim().length === 0) {
      throw new Error("OpenAI provider requires 'endpoint' to be set (base like https://api.openai.com/v1 or full path)");
    }

    const start = Date.now();
    const url = buildOpenAICompatibleUrl(input.endpoint, input.endpointType);

    const requestBody: Record<string, unknown> = {
      model: input.model,
      ...input.params,
    };

    if (input.endpointType === "chat_completions") {
      requestBody.messages = input.messages;
    } else {
      requestBody.input = input.input;
    }

    if (input.stream) {
      requestBody.stream = true;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as OpenAIResponse;
      const message = errorData.error?.message ?? `OpenAI API error: ${response.status} ${response.statusText}`;
      const code = errorData.error?.code;
      const type = errorData.error?.type;
      const err = new Error(message) as Error & { provider: string; status: number; code?: string; errorType?: string };
      err.provider = "openai";
      err.status = response.status;

      if (code) 
        err.code = code;
      if (type) 
        err.errorType = type;

      throw err;
    }

    if (input.stream) {
      let responseModel: string | undefined;
      let systemFingerprint: string | undefined;

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
              if (done) 
                break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (line.trim() === "") 
                  continue;

                const chunk = parseSSEChunk(line);
                if (!chunk) 
                  continue;

                if (chunk.model) 
                  responseModel = chunk.model;

                if (chunk.system_fingerprint) 
                  systemFingerprint = chunk.system_fingerprint;

                if (chunk.usage) {
                  tokensIn = chunk.usage.prompt_tokens ?? tokensIn;
                  tokensOut = chunk.usage.completion_tokens ?? tokensOut;
                }

                const text = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
                if (text) {
                  const sseLine = `data: ${JSON.stringify(chunk)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseLine));
                }
              }
            }

            if (buffer.trim()) {
              const chunk = parseSSEChunk(`data: ${buffer}`);
              if (chunk) {
                if (chunk.model) 
                  responseModel = chunk.model;

                if (chunk.system_fingerprint) 
                  systemFingerprint = chunk.system_fingerprint;

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
      const estimatedTokensIn = input.endpointType === "chat_completions"
        ? estimateTokens(input.messages.map((m) => m.content).join("\n"))
        : estimateTokens(Array.isArray(input.input) ? input.input.join("\n") : (input.input ?? ""));
      const estimatedTokensOut = Math.max(1, Math.floor(estimatedTokensIn * 0.25));

      return {
        output: "",
        tokensIn: estimatedTokensIn,
        tokensOut: estimatedTokensOut,
        latencyMs,
        stream,
        metadata: responseModel || systemFingerprint ? {
          model: responseModel,
          systemFingerprint,
        } : undefined,
      };
    }

    const data = (await response.json()) as OpenAIResponse;

    if (data.error) {
      const message = data.error.message ?? "OpenAI API error";
      const code = data.error.code;
      const type = data.error.type;
      const err = new Error(message) as Error & { provider: string; status: number; code?: string; errorType?: string };
      err.provider = "openai";
      err.status = 502;

      if (code) 
        err.code = code;

      if (type) 
        err.errorType = type;
      
      throw err;
    }

    let output: unknown;
    let tokensIn: number;
    let tokensOut: number;

    if (input.endpointType === "embeddings") {
      output = data.data?.map((item) => item.embedding) ?? [];
      tokensIn = data.usage?.prompt_tokens ?? estimateTokens(Array.isArray(input.input) ? input.input.join("\n") : (input.input ?? ""));
      tokensOut = 0;
    } else {
      output = data;
      tokensIn = data.usage?.prompt_tokens ?? estimateTokens(input.messages.map((m) => m.content).join("\n"));
      tokensOut = data.usage?.completion_tokens ?? Math.max(1, Math.floor(tokensIn * 0.25));
    }

    const latencyMs = Math.max(1, Date.now() - start);

    return {
      output,
      tokensIn,
      tokensOut,
      latencyMs,
      metadata: data.model || data.system_fingerprint ? {
        model: data.model,
        systemFingerprint: data.system_fingerprint,
      } : undefined,
    } as const;
  },
};
