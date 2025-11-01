import type { TelemetryEvent } from "@parapetai/parapet/runtime/telemetry/telemetry";

// Track usage in micro-dollars (1e-6 USD) to preserve precision for small calls
const tenantSpentMicros: Map<string, number> = new Map();
const routeSpentMicros: Map<string, number> = new Map();

function getTenantMicros(tenant: string): number {
  return tenantSpentMicros.get(tenant) ?? 0;
}

function getRouteMicros(route: string): number {
  return routeSpentMicros.get(route) ?? 0;
}

function setTenantMicros(tenant: string, micros: number): void {
  tenantSpentMicros.set(tenant, Math.max(0, micros));
}

function setRouteMicros(route: string, micros: number): void {
  routeSpentMicros.set(route, Math.max(0, micros));
}

export function checkAndReserve(
  tenant: string,
  route: string,
  estCostUsd: number,
  routeCapUsd: number,
  tenantCapUsd: number
):
  | { ok: true; tenantBudgetBeforeUsd: number; routeBudgetBeforeUsd: number }
  | { ok: false; reason: "budget_exceeded"; tenantBudgetBeforeUsd: number; routeBudgetBeforeUsd: number } {
  const estMicros = Math.round(estCostUsd * 1_000_000);
  const tenantBeforeMicros = getTenantMicros(tenant);
  const routeBeforeMicros = getRouteMicros(route);

  const wouldTenant = tenantBeforeMicros + estMicros;
  const wouldRoute = routeBeforeMicros + estMicros;
  const tenantCapMicros = Math.round(tenantCapUsd * 1_000_000);
  const routeCapMicros = Math.round(routeCapUsd * 1_000_000);

  if (wouldTenant > tenantCapMicros || wouldRoute > routeCapMicros) {
    return {
      ok: false,
      reason: "budget_exceeded",
      tenantBudgetBeforeUsd: tenantBeforeMicros / 1_000_000,
      routeBudgetBeforeUsd: routeBeforeMicros / 1_000_000,
    } as const;
  }

  setTenantMicros(tenant, wouldTenant);
  setRouteMicros(route, wouldRoute);
  return {
    ok: true,
    tenantBudgetBeforeUsd: tenantBeforeMicros / 1_000_000,
    routeBudgetBeforeUsd: routeBeforeMicros / 1_000_000,
  } as const;
}

export function finalize(tenant: string, route: string, estCostUsd: number, finalCostUsd: number): void {
  const deltaMicros = Math.round((finalCostUsd - estCostUsd) * 1_000_000);
  if (deltaMicros === 0) return;
  setTenantMicros(tenant, getTenantMicros(tenant) + deltaMicros);
  setRouteMicros(route, getRouteMicros(route) + deltaMicros);
}

export function rebuildFromRows(rows: readonly TelemetryEvent[]): void {
  tenantSpentMicros.clear();
  routeSpentMicros.clear();
  for (const r of rows) {
    const usd = typeof r.final_cost_usd === "number" ? r.final_cost_usd : r.est_cost_usd;
    const micros = Math.round(usd * 1_000_000);
    setTenantMicros(r.tenant, getTenantMicros(r.tenant) + micros);
    setRouteMicros(r.route, getRouteMicros(r.route) + micros);
  }
}