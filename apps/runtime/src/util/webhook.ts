import crypto from "node:crypto";
import type { HydratedRoute } from "@parapetai/config-core";
import type { RuntimeContext } from "../core/state";
import { log, LogLevel } from "./log";
import { getRouteSpendTodayUsd, getTenantSpendTodayUsd } from "../policy/budget";

export type AuditEventType = "policy_decision" | "request_error" | "provider_error";

export interface AuditEventBody {
  readonly timestamp: string;
  readonly tenant: string | null;
  readonly route: string | null;
  readonly model: string | null;
  readonly decision: "allow" | "block";
  readonly reason_if_blocked: string | null;
  readonly estimated_cost_usd: number;
  readonly actual_cost_usd: number;
  readonly budget_daily_usd: number | null;
  readonly budget_spend_today_usd: number | null;
  readonly tenant_budget_daily_usd: number | null;
  readonly tenant_budget_spend_today_usd: number | null;
  readonly redaction_mode: "warn" | "block" | "off" | null;
  readonly drift_strict: boolean | null;
  readonly prompt_excerpt: string;
  readonly retry_count?: number;
  readonly cache_hit?: boolean;
}

function shouldEmitForEvent(route: HydratedRoute, eventType: AuditEventType): boolean {
  const cfg = route.webhook;
  if (!cfg) return false;
  switch (eventType) {
    case "policy_decision":
      return cfg.events.policy_decisions;
    case "request_error":
      return cfg.events.request_errors;
    case "provider_error":
      return cfg.events.provider_errors;
  }
}

export function emitAuditEvent(rt: RuntimeContext, routeName: string, eventType: AuditEventType, body: AuditEventBody): void {
  const route = rt.routeByName.get(routeName);
  if (!route || !route.webhook) return;
  if (!shouldEmitForEvent(route, eventType)) return;

  // Resolve secret from vault; fall back to hydrated secret
  const secret = rt.vault.get(`route:${routeName}:webhook_secret`) ?? route.webhook.secret;
  const url = route.webhook.url;

  const json = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(json).digest("hex");

  // Fire-and-forget
  setImmediate(async () => {
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Parapet-Signature": `sha256=${sig}`,
        },
        body: json,
        keepalive: true,
      });
    } catch (err) {
      // prettier-ignore
      log(LogLevel.warn, `webhook post failed for route ${routeName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

export interface QueueAuditParams {
  readonly tenant: string;
  readonly decision: "allow" | "block";
  readonly reason_if_blocked?: string | null;
  readonly estimated_cost_usd?: number;
  readonly actual_cost_usd?: number;
  readonly include_prompt_snippet?: boolean;
  readonly messages?: Array<{ role: string; content: string }>;
  readonly model_override?: string | null;
  readonly retry_count?: number;
  readonly cache_hit?: boolean;
}

export function queueAuditEvent(rt: RuntimeContext, routeName: string, eventType: AuditEventType, params: QueueAuditParams): void {
  const route = rt.routeByName.get(routeName);
  if (!route) 
    return;

  // Build lazily and schedule off the hot path
  setImmediate(() => {
    const timestamp = new Date().toISOString();
    const model = params.model_override ?? route.provider.model ?? null;

    const routeSpend = getRouteSpendTodayUsd(route.name);
    const tenantSpend = getTenantSpendTodayUsd(params.tenant);
    const prompt_excerpt = (() => {
      if (!route.webhook?.include_prompt_snippet || !params.include_prompt_snippet) return "";
      const msgs = params.messages;
      if (!msgs || msgs.length === 0) return "";
      const text = msgs.map((m) => m.content).join("\n");
      return text.slice(0, 80);
    })();

    const body: AuditEventBody = {
      timestamp,
      tenant: params.tenant ?? null,
      route: route.name,
      model,
      decision: params.decision,
      reason_if_blocked: params.reason_if_blocked ?? (params.decision === "block" ? "unknown" : null),
      estimated_cost_usd: params.estimated_cost_usd ?? 0,
      actual_cost_usd: params.actual_cost_usd ?? 0,
      budget_daily_usd: route.policy?.budget_daily_usd ?? null,
      budget_spend_today_usd: routeSpend,
      tenant_budget_daily_usd: rt.tenantByName.get(params.tenant)?.spend.daily_usd_cap ?? null,
      tenant_budget_spend_today_usd: tenantSpend,
      redaction_mode: route.policy?.redaction.mode ?? null,
      drift_strict: route.policy?.drift_strict ?? null,
      prompt_excerpt,
      retry_count: params.retry_count,
      cache_hit: params.cache_hit,
    };

    if (route.webhook && shouldEmitForEvent(route, eventType)) {
      emitAuditEvent(rt, route.name, eventType, body);
      return;
    }

    // prettier-ignore
    log(LogLevel.info, `audit_event type=${eventType} tenant=${params.tenant} route=${route.name} decision=${params.decision} reason=${body.reason_if_blocked ?? "-"} est_cost_usd=${body.estimated_cost_usd.toFixed(6)} actual_cost_usd=${body.actual_cost_usd.toFixed(6)} model=${model ?? "unknown"}`);
  });
}


