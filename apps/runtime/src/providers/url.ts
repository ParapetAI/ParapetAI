import type { EndpointType } from "./types";

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function hasFinalPath(url: string): boolean {
  const u = url.toLowerCase();
  return u.endsWith("/chat/completions") || u.endsWith("/embeddings");
}

function hasVersionSegment(url: string): boolean {
  // crude check for /v{number} at the end
  return /\/v\d+$/i.test(url);
}

export function buildOpenAICompatibleUrl(
  endpoint: string | undefined,
  endpointType: EndpointType
): string {
  const path = endpointType === "embeddings" ? "embeddings" : "chat/completions";

  if (!endpoint || endpoint.trim().length === 0) {
    throw new Error("Provider requires 'endpoint' to be set (base or full path)");
  }

  const normalized = trimTrailingSlash(endpoint);

  if (hasFinalPath(normalized)) {
    return normalized;
  }

  if (hasVersionSegment(normalized)) {
    return `${normalized}/${path}`;
  }

  // Any other shape is treated as an explicit full path base; return as-is
  return normalized;
}


