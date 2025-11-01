import type { TelemetryEvent } from "@parapetai/parapet/runtime/telemetry/telemetry";

const tenantSpentCents: Map<string, number> = new Map();
const routeSpentCents: Map<string, number> = new Map();

function getTenantCents(tenant: string): number {
  return tenantSpentCents.get(tenant) ?? 0;
}

function getRouteCents(route: string): number {
  return routeSpentCents.get(route) ?? 0;
}

function setTenantCents(tenant: string, cents: number): void {
  tenantSpentCents.set(tenant, Math.max(0, cents));
}

function setRouteCents(route: string, cents: number): void {
  routeSpentCents.set(route, Math.max(0, cents));
}

export function checkAndReserve(
  tenant: string,
  route: string,
  estCostUsd: number,
  routeCapUsd: number,
  tenantCapUsd: number
): { ok: true; budgetBeforeUsd: number } | { ok: false; reason: "budget_exceeded"; budgetBeforeUsd: number } {
  const estCents = Math.round(estCostUsd * 100);
  const tenantBeforeCents = getTenantCents(tenant);
  const routeBeforeCents = getRouteCents(route);

  const wouldTenant = tenantBeforeCents + estCents;
  const wouldRoute = routeBeforeCents + estCents;
  const tenantCapCents = Math.round(tenantCapUsd * 100);
  const routeCapCents = Math.round(routeCapUsd * 100);

  if (wouldTenant > tenantCapCents || wouldRoute > routeCapCents) {
    return { ok: false, reason: "budget_exceeded", budgetBeforeUsd: tenantBeforeCents / 100 } as const;
  }

  setTenantCents(tenant, wouldTenant);
  setRouteCents(route, wouldRoute);
  return { ok: true, budgetBeforeUsd: tenantBeforeCents / 100 } as const;
}

export function finalize(tenant: string, route: string, estCostUsd: number, finalCostUsd: number): void {
  const deltaCents = Math.round((finalCostUsd - estCostUsd) * 100);
  if (deltaCents === 0) return;
  setTenantCents(tenant, getTenantCents(tenant) + deltaCents);
  setRouteCents(route, getRouteCents(route) + deltaCents);
}

export function rebuildFromRows(rows: readonly TelemetryEvent[]): void {
  tenantSpentCents.clear();
  routeSpentCents.clear();
  for (const r of rows) {
    const usd = typeof r.final_cost_usd === "number" ? r.final_cost_usd : r.est_cost_usd;
    const cents = Math.round(usd * 100);
    setTenantCents(r.tenant, getTenantCents(r.tenant) + cents);
    setRouteCents(r.route, getRouteCents(r.route) + cents);
  }
}