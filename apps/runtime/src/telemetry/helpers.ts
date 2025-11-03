import type { RuntimeContext } from "../core/state";
import type { TelemetryEvent } from "./telemetry";
import { recordCall } from "./telemetry";
import { queueAuditEvent } from "../util/webhook";
import { getTenantSpendTodayUsd } from "../policy/budget";

interface DecisionArgs {
  readonly tenant: string;
  readonly routeName: string;
  readonly serviceLabel: string;
  readonly allowed: boolean;
  readonly redactionApplied?: boolean;
  readonly reasonIfBlocked?: string;
  readonly budgetBeforeUsd?: number;
  readonly estCostUsd?: number;
  readonly finalCostUsd?: number;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly latencyMs?: number;
  readonly messagesForSnippet?: Array<{ role: string; content: string }>;
  readonly includePromptSnippet?: boolean;
  readonly responseModel?: string;
  readonly systemFingerprint?: string;
  readonly driftDetected?: boolean;
  readonly driftReason?: string;
}

export function recordCallAndAuditDecision(rt: RuntimeContext, args: DecisionArgs): void {
  const route = rt.routeByName.get(args.routeName);
  if (!route) return;

  const driftStrict: boolean = route.policy.drift_strict;
  const budgetBefore: number =
    typeof args.budgetBeforeUsd === "number"
      ? args.budgetBeforeUsd
      : getTenantSpendTodayUsd(args.tenant);

  const telemetry: TelemetryEvent = {
    ts: Date.now(),
    tenant: args.tenant,
    route: route.name,
    service_label: args.serviceLabel,
    allowed: args.allowed,
    block_reason: args.allowed ? undefined : args.reasonIfBlocked ?? "unknown",
    redaction_applied: args.allowed ? (args.redactionApplied ?? false) : false,
    drift_strict: driftStrict,
    budget_before_usd: budgetBefore,
    est_cost_usd: typeof args.estCostUsd === "number" ? args.estCostUsd : 0,
    final_cost_usd: args.allowed ? args.finalCostUsd : undefined,
    tokens_in: args.tokensIn,
    tokens_out: args.tokensOut,
    latency_ms: args.latencyMs,
    checksum_config: rt.checksum,
    drift_detected: args.driftDetected,
    drift_reason: args.driftReason,
    response_model: args.responseModel,
    system_fingerprint: args.systemFingerprint,
  };

  recordCall(telemetry);

  queueAuditEvent(rt, route.name, "policy_decision", {
    tenant: args.tenant,
    decision: args.allowed ? "allow" : "block",
    reason_if_blocked: args.allowed ? null : (args.reasonIfBlocked ?? "unknown"),
    estimated_cost_usd: typeof args.estCostUsd === "number" ? args.estCostUsd : 0,
    actual_cost_usd: typeof args.finalCostUsd === "number" ? args.finalCostUsd : 0,
    include_prompt_snippet: args.includePromptSnippet === true,
    messages: args.messagesForSnippet,
  });
}

interface ProviderErrorArgs {
  readonly tenant: string;
  readonly routeName: string;
  readonly serviceLabel: string;
  readonly estCostUsd?: number;
}

export function recordCallAndAuditProviderError(rt: RuntimeContext, args: ProviderErrorArgs): void {
  const route = rt.routeByName.get(args.routeName);
  if (!route) return;

  const telemetry: TelemetryEvent = {
    ts: Date.now(),
    tenant: args.tenant,
    route: route.name,
    service_label: args.serviceLabel,
    allowed: false,
    block_reason: "provider_error",
    redaction_applied: false,
    drift_strict: route.policy.drift_strict,
    budget_before_usd: getTenantSpendTodayUsd(args.tenant),
    est_cost_usd: typeof args.estCostUsd === "number" ? args.estCostUsd : 0,
    checksum_config: rt.checksum,
  };

  recordCall(telemetry);

  queueAuditEvent(rt, route.name, "provider_error", {
    tenant: args.tenant,
    decision: "block",
    reason_if_blocked: "server_error",
    estimated_cost_usd: typeof args.estCostUsd === "number" ? args.estCostUsd : 0,
    actual_cost_usd: 0,
  });
}


