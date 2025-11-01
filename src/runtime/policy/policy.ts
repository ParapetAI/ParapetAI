import { getCallerContext } from "@parapetai/parapet/runtime/security/auth";
import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";
import { checkDriftStrict } from "@parapetai/parapet/runtime/security/drift";
import { redact } from "@parapetai/parapet/runtime/security/redaction";
import { estimateTokens, estimateCost } from "@parapetai/parapet/runtime/util/cost";
import { checkAndReserve } from "@parapetai/parapet/runtime/policy/budget";
import type { PolicyDecision } from "@parapetai/parapet/runtime/core/types";

export async function evaluatePolicy(serviceKey: string, routeName: string, prompt: string): Promise<PolicyDecision> {
  const runtime = getRuntimeContext();

  const caller = getCallerContext(serviceKey);
  if (!caller) return { allowed: false, reason: "unauthorized" } as const;

  if (!caller.allowedRoutes.includes(routeName)) return { allowed: false, reason: "not_allowed" } as const;

  const route = runtime.routeByName.get(routeName);
  if (!route) return { allowed: false, reason: "unknown_route" } as const;

  if (route.tenant !== caller.tenant) return { allowed: false, reason: "tenant_mismatch" } as const;

  const tokensIn = estimateTokens(prompt);
  if (tokensIn > route.policy.max_tokens_in) return { allowed: false, reason: "max_tokens_in_exceeded" } as const;
  const maxTokensOut = route.policy.max_tokens_out;
  const tokensOutGuess = Math.min(maxTokensOut, Math.max(1, Math.floor(tokensIn * 0.25)));

  const drift = checkDriftStrict(route, { provider: route.provider.type, model: route.provider.model });
  if (!drift.ok) return { allowed: false, reason: drift.reason } as const;

  const redactionMode = route.policy.redaction.mode;
  const redactionPatterns = route.policy.redaction.patterns;
  const redactionResult = redact(prompt, redactionMode, redactionPatterns);
  if ("blocked" in redactionResult) return { allowed: false, reason: redactionResult.reason } as const;
  const sanitizedPrompt = redactionResult.output;
  const redactionApplied = redactionResult.applied;

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
    sanitizedPrompt,
    routeMeta: { tenant: tenant.name, provider: route.provider.type, model: route.provider.model, routeName },
    budgetBeforeUsd: budget.tenantBudgetBeforeUsd,
    estCostUsd,
    redactionApplied,
    driftStrict: route.policy.drift_strict,
  } as const;
}
