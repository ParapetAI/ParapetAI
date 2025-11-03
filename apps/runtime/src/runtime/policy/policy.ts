import { getCallerContext } from "../security/auth";
import { getRuntimeContext } from "../core/state";
import { redact } from "../security/redaction";
import { estimateTokens, estimateCost } from "../util/cost";
import { checkAndReserve } from "./budget";
import { mergeParams, enforceMaxTokens } from "../../providers/params";
import type { PolicyDecision } from "../core/types";

export interface PolicyInput {
  readonly messages?: Array<{ role: string; content: string }>;
  readonly input?: string | string[];
  params?: Readonly<Record<string, unknown>>;
}

export async function evaluatePolicy(serviceKey: string, routeName: string, input: PolicyInput): Promise<PolicyDecision> {
  const runtime = getRuntimeContext();

  const caller = getCallerContext(serviceKey);
  if (!caller) return { allowed: false, reason: "unauthorized" } as const;

  if (!caller.allowedRoutes.includes(routeName)) return { allowed: false, reason: "not_allowed" } as const;

  const route = runtime.routeByName.get(routeName);
  if (!route) return { allowed: false, reason: "unknown_route" } as const;

  if (route.tenant !== caller.tenant) return { allowed: false, reason: "tenant_mismatch" } as const;

  const endpointType = route.provider.endpoint_type ?? "chat_completions";

  const defaultParams: Readonly<Record<string, unknown>> | undefined = route.provider.default_params;
  const requestParams: Readonly<Record<string, unknown>> = input.params ?? {};
  const mergedParams = mergeParams(defaultParams, requestParams);
  const enforcedParams = enforceMaxTokens(mergedParams, route.policy.max_tokens_out, endpointType);
  const enforcedParamsRecord = enforcedParams as Record<string, unknown>;
  const maxTokensRaw = enforcedParamsRecord.max_tokens;
  let maxTokensCap = route.policy.max_tokens_out;
  if (typeof maxTokensRaw === "number") {
    maxTokensCap = Math.max(0, Math.floor(maxTokensRaw));
  } else if (typeof maxTokensRaw === "string") {
    const parsed = Number(maxTokensRaw);
    if (Number.isFinite(parsed)) {
      maxTokensCap = Math.max(0, Math.floor(parsed));
    }
  }

  let textToCheck: string;
  let tokensIn: number;

  if (endpointType === "embeddings") {
    const inputText = Array.isArray(input.input) ? input.input.join("\n") : (input.input ?? "");
    textToCheck = inputText;
    tokensIn = estimateTokens(inputText);
  } else {
    const messagesText = input.messages?.map((m) => m.content).join("\n") ?? "";
    textToCheck = messagesText;
    tokensIn = estimateTokens(messagesText);
  }
  
  if (tokensIn > route.policy.max_tokens_in) return { allowed: false, reason: "max_tokens_in_exceeded" } as const;
  
  const maxTokensOut = route.policy.max_tokens_out;
  const tokensOutGuess = endpointType === "embeddings"
    ? 0
    : (() => {
      const effectiveCap = Math.min(maxTokensCap, maxTokensOut);
      if (effectiveCap <= 0) return 0;
      const baseFloor: number = 32;
      const ratioGuess = Math.ceil(tokensIn * 1.4);
      const additiveGuess = Math.ceil(tokensIn + 12);
      const unconstrainedGuess = Math.max(baseFloor, ratioGuess, additiveGuess);
      const boundedGuess = Math.min(effectiveCap, unconstrainedGuess);
      return Math.max(1, boundedGuess);
    })();

  const redactionMode = route.policy.redaction.mode;
  const redactionPatterns = route.policy.redaction.patterns;
  let redactionApplied = false;
  let sanitizedMessages: Array<{ role: string; content: string }> | undefined;
  let sanitizedInput: string | string[] | undefined;
  
  if (endpointType === "embeddings") {
    const inputText = Array.isArray(input.input) ? input.input.join("\n") : (input.input ?? "");
    const redactionResult = redact(inputText, redactionMode, redactionPatterns);
    if ("blocked" in redactionResult) return { allowed: false, reason: redactionResult.reason } as const;
    sanitizedInput = Array.isArray(input.input) ? redactionResult.output.split("\n") : redactionResult.output;
    redactionApplied = redactionResult.applied;
  } else {
    if (!input.messages || input.messages.length === 0) {
      return { allowed: false, reason: "invalid_body" } as const;
    }
    const messagesText = input.messages.map((m) => m.content).join("\n");
    const redactionResult = redact(messagesText, redactionMode, redactionPatterns);
    if ("blocked" in redactionResult) return { allowed: false, reason: redactionResult.reason } as const;
    
    if (redactionResult.applied) {
      const parts = redactionResult.output.split("\n");
      sanitizedMessages = input.messages.map((m, i) => ({
        role: m.role,
        content: parts[i] ?? m.content,
      }));
    } else {
      sanitizedMessages = input.messages;
    }
    redactionApplied = redactionResult.applied;
  }

  const tenant = runtime.tenantByName.get(route.tenant);
  if (!tenant) return { allowed: false, reason: "unknown_tenant" } as const;

  const estCostUsd = estimateCost(route.provider.type, route.provider.model, tokensIn, tokensOutGuess);
  const budget = checkAndReserve(tenant.name, route.name, estCostUsd, route.policy.budget_daily_usd, tenant.spend.daily_usd_cap);
  if (!budget.ok)
    return {
      allowed: false,
      reason: budget.reason,
      blockMeta: { tenantBudgetBeforeUsd: budget.tenantBudgetBeforeUsd, routeBudgetBeforeUsd: budget.routeBudgetBeforeUsd },
    } as const;

  return {
    allowed: true,
    sanitizedMessages,
    sanitizedInput,
    routeMeta: { tenant: tenant.name, provider: route.provider.type, model: route.provider.model, routeName },
    budgetBeforeUsd: budget.tenantBudgetBeforeUsd,
    estCostUsd,
    redactionApplied,
    driftStrict: route.policy.drift_strict,
  } as const;
}
