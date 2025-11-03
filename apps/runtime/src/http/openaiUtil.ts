import type { FastifyReply } from "fastify";
import { getRuntimeContext } from "../core/state";
import type { EndpointType } from "../providers/types";

export function extractBearerToken(headerValue: string): string | null {
  const trimmed = headerValue.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function extractParams(
  body: Readonly<Record<string, unknown>>,
  excludeKeys: readonly string[] = []
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (excludeKeys.includes(key)) continue;
    if (value !== undefined) params[key] = value;
  }
  return params;
}

export function selectRouteNameByModel(
  allowedRoutes: readonly string[],
  model: string,
  rt: ReturnType<typeof getRuntimeContext>,
  endpointType: EndpointType
): string | null {
  for (const name of allowedRoutes) {
    const r = rt.routeByName.get(name);
    if (!r) continue;
    const et = r.provider.endpoint_type ?? "chat_completions";
    if (et !== endpointType) continue;
    if (r.provider.model === model) return r.name;
  }
  return null;
}

export function sendOpenAIError(reply: FastifyReply, statusCode: number, message: string, type: string, code?: string) {
  const body = { error: { message, type, ...(code ? { code } : {}) } } as const;
  return reply.code(statusCode).send(body);
}

// Canonical error keys so handlers use a single entry point
export type OpenAIErrorKey =
  | "invalid_json"
  | "invalid_parapet_api_key"
  | "invalid_openai_api_key"
  | "invalid_body"
  | "unknown_route"
  | "drift_violation"
  | "insufficient_permissions"
  | "budget_exceeded"
  | "max_tokens_in_exceeded"
  | "redaction_blocked"
  | "upstream_error";

export interface SendErrorOptions {
  readonly routeName?: string;
  readonly providerName?: string;
  readonly upstreamStatus?: number;
}

export function sendError(reply: FastifyReply, key: OpenAIErrorKey, options: SendErrorOptions = {}) {
  switch (key) {
    case "invalid_json":
      return sendOpenAIError(reply, 400, "Invalid JSON.", "invalid_request_error");
    case "invalid_parapet_api_key":
      return sendOpenAIError(
        reply,
        401,
        "Invalid ParapetAI API key in Authorization header.",
        "invalid_request_error",
        "invalid_api_key"
      );
    case "invalid_openai_api_key":
      return sendOpenAIError(
        reply,
        401,
        `Invalid OpenAI API key configured${options.routeName ? ` for route \"${options.routeName}\"` : ""}.`,
        "invalid_request_error",
        "invalid_api_key"
      );
    case "invalid_body":
      return sendOpenAIError(reply, 400, "Invalid request body.", "invalid_request_error", "invalid_body");
    case "unknown_route":
      return sendOpenAIError(reply, 400, "Unknown route.", "invalid_request_error", "unknown_route");
    case "drift_violation":
      return sendOpenAIError(
        reply,
        400,
        "Requested model is not allowed for this token.",
        "invalid_request_error",
        "drift_violation"
      );
    case "insufficient_permissions":
      return sendOpenAIError(reply, 403, "Insufficient permissions.", "insufficient_permissions");
    case "budget_exceeded":
      return sendOpenAIError(reply, 429, "Budget exceeded.", "rate_limit_exceeded", "budget_exceeded");
    case "max_tokens_in_exceeded":
      return sendOpenAIError(reply, 400, "max_tokens_in_exceeded", "invalid_request_error", "max_tokens_in_exceeded");
    case "redaction_blocked":
      return sendOpenAIError(reply, 400, "Request blocked by policy.", "invalid_request_error", "redaction_blocked");
    case "upstream_error": {
      const provider = options.providerName ?? "Upstream provider";
      const label = options.upstreamStatus ? `${provider} error (status ${options.upstreamStatus}).` : `${provider} error.`;
      return sendOpenAIError(reply, 502, label, "server_error");
    }
    default:
      return sendOpenAIError(reply, 400, "Invalid request.", "invalid_request_error");
  }
}

export function sendPolicyReasonError(reply: FastifyReply, reason: string) {
  switch (reason) {
    case "unauthorized":
      return sendError(reply, "invalid_parapet_api_key");
    case "not_allowed":
    case "tenant_mismatch":
      return sendError(reply, "insufficient_permissions");
    case "budget_exceeded":
      return sendError(reply, "budget_exceeded");
    case "max_tokens_in_exceeded":
      return sendError(reply, "max_tokens_in_exceeded");
    case "drift_violation":
      return sendError(reply, "drift_violation");
    case "redaction_blocked":
      return sendError(reply, "redaction_blocked");
    case "invalid_body":
      return sendError(reply, "invalid_body");
    default:
      return sendOpenAIError(reply, 400, reason, "invalid_request_error", reason);
  }
}

export function mapPolicyReasonToErrorKey(reason: string): OpenAIErrorKey {
  switch (reason) {
    case "unauthorized":
      return "invalid_parapet_api_key";
    case "not_allowed":
    case "tenant_mismatch":
      return "insufficient_permissions";
    case "budget_exceeded":
      return "budget_exceeded";
    case "max_tokens_in_exceeded":
      return "max_tokens_in_exceeded";
    case "drift_violation":
      return "drift_violation";
    case "redaction_blocked":
      return "redaction_blocked";
    case "invalid_body":
      return "invalid_body";
    default:
      return "invalid_body";
  }
}

export function mapDecisionReason(reason: string): string {
  switch (reason) {
    case "budget_exceeded":
      return "budget_exceeded";
    case "redaction_blocked":
      return "redaction_violation";
    case "drift_violation":
      return "drift_violation";
    default:
      return reason;
  }
}


