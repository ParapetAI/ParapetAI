import type { EndpointType } from "./types";
import type { ProviderType } from "@parapetai/config-core";

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

const allowedChatKeys = new Set<string>([
  // sampling & penalties
  "temperature",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  // tokens
  "max_tokens",
  "max_completion_tokens",
  // generation controls
  "stop",
  "n",
  // logits & logging
  "logit_bias",
  "logprobs",
  "top_logprobs",
  // determinism
  "seed",
  // output formatting
  "response_format",
  // tools
  "tools",
  "tool_choice",
  "parallel_tool_calls",
  // service tier & storage
  "service_tier",
  "store",
  // streaming
  "stream_options",
  // modalities & metadata
  "modalities",
  "metadata",
  // reasoning
  "reasoning_effort",
  // misc documented params
  "prompt_cache_key",
  "safety_identifier",
  "prediction",
]);

const allowedEmbeddingKeys = new Set<string>([
  "dimensions",
  "encoding_format",
  "user",
]);


function validateOpenAIParams(params: Record<string, unknown>, endpointType: EndpointType): ValidationResult {
  if (endpointType === "chat_completions") {
    const unknownKeys = Object.keys(params).filter((k) => !allowedChatKeys.has(k));
    if (unknownKeys.length > 0) {
      return { valid: false, error: `unsupported parameters: ${unknownKeys.join(", ")}` };
    }

    if (params.temperature !== undefined) {
      const temp = Number(params.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        return { valid: false, error: "temperature must be between 0 and 2" };
      }
    }
    if (params.top_p !== undefined) {
      const topP = Number(params.top_p);
      if (isNaN(topP) || topP < 0 || topP > 1) {
        return { valid: false, error: "top_p must be between 0 and 1" };
      }
    }
    if (params.frequency_penalty !== undefined) {
      const freq = Number(params.frequency_penalty);
      if (isNaN(freq) || freq < -2 || freq > 2) {
        return { valid: false, error: "frequency_penalty must be between -2 and 2" };
      }
    }
    if (params.presence_penalty !== undefined) {
      const pres = Number(params.presence_penalty);
      if (isNaN(pres) || pres < -2 || pres > 2) {
        return { valid: false, error: "presence_penalty must be between -2 and 2" };
      }
    }
    if (params.reasoning_effort !== undefined) {
      const reasoningEffort = params.reasoning_effort;
      if (typeof reasoningEffort !== "string") {
        return { valid: false, error: "reasoning_effort must be a string" };
      }
      const validValues = ["minimal", "low", "medium", "high"];
      if (!validValues.includes(reasoningEffort)) {
        return { valid: false, error: `reasoning_effort must be one of: ${validValues.join(", ")}` };
      }
    }

    // Additional chat validations
    if (params.stop !== undefined) {
      const stop = params.stop as unknown;
      const isString = typeof stop === "string";
      const isStringArray = Array.isArray(stop) && (stop as unknown[]).every((item) => typeof item === "string");
      if (!isString && !isStringArray) {
        return { valid: false, error: "stop must be a string or string[]" };
      }
    }
    if (params.n !== undefined) {
      const nValue = Number(params.n);
      if (!Number.isInteger(nValue) || nValue < 1) {
        return { valid: false, error: "n must be a positive integer" };
      }
    }
    if (params.logit_bias !== undefined) {
      const logitBias = params.logit_bias as unknown;
      if (logitBias == null || typeof logitBias !== "object" || Array.isArray(logitBias)) {
        return { valid: false, error: "logit_bias must be an object of token->bias" };
      }
      for (const biasValue of Object.values(logitBias as Record<string, unknown>)) {
        const num = Number(biasValue);
        if (!Number.isFinite(num) || num < -100 || num > 100) {
          return { valid: false, error: "logit_bias values must be numbers in [-100, 100]" };
        }
      }
    }
    if (params.logprobs !== undefined) {
      if (typeof params.logprobs !== "boolean") {
        return { valid: false, error: "logprobs must be a boolean" };
      }
    }
    if (params.top_logprobs !== undefined) {
      const tlp = Number(params.top_logprobs);
      if (!Number.isInteger(tlp) || tlp < 0 || tlp > 20) {
        return { valid: false, error: "top_logprobs must be an integer between 0 and 20" };
      }
    }
    if (params.seed !== undefined) {
      const seed = Number(params.seed);
      if (!Number.isInteger(seed)) {
        return { valid: false, error: "seed must be an integer" };
      }
    }
    if (params.response_format !== undefined) {
      const responseFormat = params.response_format as unknown;
      if (responseFormat == null || typeof responseFormat !== "object" || Array.isArray(responseFormat)) {
        return { valid: false, error: "response_format must be an object" };
      }
      const type = (responseFormat as Record<string, unknown>).type;
      if (type !== "json_object" && type !== "json_schema" && type !== "text") {
        return { valid: false, error: "response_format.type must be 'text', 'json_object', or 'json_schema'" };
      }
      if (type === "json_schema") {
        const jsonSchema = (responseFormat as Record<string, unknown>).json_schema;
        if (jsonSchema == null || typeof jsonSchema !== "object" || Array.isArray(jsonSchema)) {
          return { valid: false, error: "response_format.json_schema must be an object when type is 'json_schema'" };
        }
      }
    }
    if (params.tools !== undefined) {
      if (!Array.isArray(params.tools)) {
        return { valid: false, error: "tools must be an array" };
      }
    }
    if (params.tool_choice !== undefined) {
      const toolChoice = params.tool_choice as unknown;
      const isToolChoiceString = toolChoice === "none" || toolChoice === "auto" || toolChoice === "required";
      const isToolChoiceObject = typeof toolChoice === "object" && toolChoice != null;
      if (!isToolChoiceString && !isToolChoiceObject) {
        return { valid: false, error: "tool_choice must be 'none' | 'auto' | 'required' | object" };
      }
    }
    if (params.parallel_tool_calls !== undefined && typeof params.parallel_tool_calls !== "boolean") {
      return { valid: false, error: "parallel_tool_calls must be a boolean" };
    }
    if (params.service_tier !== undefined) {
      const serviceTier = params.service_tier;
      const isValidServiceTier = serviceTier === "auto" || serviceTier === "default" || serviceTier === "flex" || serviceTier === "scale" || serviceTier === "priority";
      if (!isValidServiceTier) return { valid: false, error: "service_tier must be one of: auto, default, flex, scale, priority" };
    }
    if (params.store !== undefined && typeof params.store !== "boolean") {
      return { valid: false, error: "store must be a boolean" };
    }
    if (params.stream_options !== undefined) {
      const streamOptions = params.stream_options as unknown;
      if (streamOptions == null || typeof streamOptions !== "object" || Array.isArray(streamOptions)) {
        return { valid: false, error: "stream_options must be an object" };
      }
    }
    if (params.modalities !== undefined) {
      const mods = params.modalities as unknown;
      if (!Array.isArray(mods) || !(mods as unknown[]).every((modality) => modality === "text" || modality === "audio")) {
        return { valid: false, error: "modalities must be an array containing 'text' and/or 'audio'" };
      }
    }
    if (params.metadata !== undefined) {
      const metadata = params.metadata as unknown;
      if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
        return { valid: false, error: "metadata must be an object" };
      }
    }
    if (params.max_completion_tokens !== undefined) {
      const mct = Number(params.max_completion_tokens);
      if (!Number.isInteger(mct) || mct < 1) {
        return { valid: false, error: "max_completion_tokens must be a positive integer" };
      }
    }
  }

  if (endpointType === "embeddings") {
    const unknownEmbKeys = Object.keys(params).filter((k) => !allowedEmbeddingKeys.has(k));
    if (unknownEmbKeys.length > 0) {
      return { valid: false, error: `unsupported parameters: ${unknownEmbKeys.join(", ")}` };
    }
    if (params.dimensions !== undefined) {
      const dim = Number(params.dimensions);
      if (!Number.isInteger(dim) || dim < 1) {
        return { valid: false, error: "dimensions must be a positive integer" };
      }
    }
    if (params.encoding_format !== undefined) {
      const encodingFormat = params.encoding_format;
      if (encodingFormat !== "float" && encodingFormat !== "base64") {
        return { valid: false, error: "encoding_format must be 'float' or 'base64'" };
      }
    }
    if (params.user !== undefined && typeof params.user !== "string") {
      return { valid: false, error: "user must be a string" };
    }
  }

  if (params.max_tokens !== undefined) {
    const maxTokens = Number(params.max_tokens);
    if (isNaN(maxTokens) || maxTokens < 1 || !Number.isInteger(maxTokens)) {
      return { valid: false, error: "max_tokens must be a positive integer" };
    }
  }
  return { valid: true };
}

export function validateParams(
  providerType: ProviderType,
  endpointType: EndpointType,
  params: Record<string, unknown>
): ValidationResult {
  if (providerType === "openai" || providerType === "local") {
    return validateOpenAIParams(params, endpointType);
  }
  return { valid: true };
}

export function mergeParams(
  routeDefaults: Readonly<Record<string, unknown>> | undefined,
  requestParams: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  if (routeDefaults) {
    for (const [key, value] of Object.entries(routeDefaults)) {
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(requestParams)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  
  return merged;
}

export function enforceMaxTokens(
  params: Record<string, unknown>,
  maxTokensOut: number,
  endpointType: EndpointType
): Record<string, unknown> {
  if (endpointType === "embeddings") {
    return params;
  }

  // When policy is omitted, we treat maxTokensOut<=0 as "do not enforce"
  if (!Number.isFinite(maxTokensOut) || maxTokensOut <= 0) {
    return params;
  }

  const currentMaxTokens = params.max_tokens !== undefined ? Number(params.max_tokens) : undefined;
  if (currentMaxTokens === undefined || currentMaxTokens > maxTokensOut) {
    return { ...params, max_tokens: maxTokensOut };
  }

  return params;
}

