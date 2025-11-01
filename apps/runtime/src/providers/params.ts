import type { EndpointType } from "./types";
import type { ProviderType } from "../config/spec/types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

function validateOpenAIParams(params: Record<string, unknown>, endpointType: EndpointType): ValidationResult {
  if (endpointType === "chat_completions") {
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
  }
  if (params.max_tokens !== undefined) {
    const maxTokens = Number(params.max_tokens);
    if (isNaN(maxTokens) || maxTokens < 1 || !Number.isInteger(maxTokens)) {
      return { valid: false, error: "max_tokens must be a positive integer" };
    }
  }
  return { valid: true };
}

function validateAnthropicParams(params: Record<string, unknown>): ValidationResult {
  if (params.temperature !== undefined) {
    const temp = Number(params.temperature);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      return { valid: false, error: "temperature must be between 0 and 1" };
    }
  }
  if (params.top_p !== undefined) {
    const topP = Number(params.top_p);
    if (isNaN(topP) || topP < 0 || topP > 1) {
      return { valid: false, error: "top_p must be between 0 and 1" };
    }
  }
  if (params.top_k !== undefined) {
    const topK = Number(params.top_k);
    if (isNaN(topK) || topK < 1 || !Number.isInteger(topK)) {
      return { valid: false, error: "top_k must be a positive integer" };
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
  if (providerType === "anthropic") {
    return validateAnthropicParams(params);
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
  const currentMaxTokens = params.max_tokens !== undefined ? Number(params.max_tokens) : undefined;
  if (currentMaxTokens === undefined || currentMaxTokens > maxTokensOut) {
    return { ...params, max_tokens: maxTokensOut };
  }
  return params;
}

