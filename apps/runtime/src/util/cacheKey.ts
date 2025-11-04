import type { HydratedRoute } from "@parapetai/config-core";

type EndpointType = HydratedRoute["provider"]["endpoint_type"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  
  for (const k of keys) {
    parts.push(`${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  }
  return `{${parts.join(",")}}`;
}

function stripVolatileParams(params: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    const key = k.toLowerCase();
    if (key === "client_request_id" || key === "request_id" || key === "trace_id") continue;
    out[k] = v;
  }
  return out;
}

export function buildCacheKey(
  route: HydratedRoute,
  endpointType: EndpointType,
  sanitized:
    | { readonly messages: ReadonlyArray<{ readonly role: string; readonly content: string }>; readonly input?: undefined }
    | { readonly messages?: undefined; readonly input: string | readonly string[] },
  mergedParams: Readonly<Record<string, unknown>> | undefined,
  includeParams: boolean,
  redactionMode: "warn" | "block" | "off"
): string {
  const base = {
    route: route.name,
    provider: route.provider.type,
    endpoint_type: endpointType,
    model: route.provider.model,
    redaction_mode: redactionMode,
  } as const;

  const payload = isPlainObject(sanitized as any)
    ? (sanitized as any)
    : { value: sanitized };

  const params = includeParams ? stripVolatileParams(mergedParams) : undefined;

  return stableStringify({ ...base, payload, params });
}


