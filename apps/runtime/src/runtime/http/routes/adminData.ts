import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";
import { open as openTelemetry } from "@parapetai/parapet/runtime/telemetry/store";
import { getSessionFromRequest } from "@parapetai/parapet/runtime/security/session";

function requireSessionOr401(request: FastifyRequest, reply: FastifyReply): boolean {
  if (getSessionFromRequest(request)) return true;
  reply.code(401).send();
  return false;
}

export function registerAdminData(app: FastifyInstance): void {
  const store = openTelemetry();

  app.get("/console/data/checksum", async (request, reply) => {
    if (!requireSessionOr401(request, reply)) return;
    const rt = getRuntimeContext();
    reply.code(200).send({ checksum: rt.checksum });
  });

  app.get("/console/data/blocked", async (request, reply) => {
    if (!requireSessionOr401(request, reply)) return;
    const rows = await store.loadTodayRows();
    const summary = {
      budget_exceeded: 0,
      not_allowed: 0,
      drift_violation: 0,
      redaction_blocked: 0,
      total: 0,
    } as Record<string, number>;
    for (const r of rows) {
      if (r.allowed) continue;
      const reason = r.block_reason ?? "unknown";
      if (summary[reason] === undefined) summary[reason] = 0;
      summary[reason] += 1;
      summary.total += 1;
    }
    reply.code(200).send(summary);
  });

  app.get("/console/data/usage", async (request, reply) => {
    if (!requireSessionOr401(request, reply)) return;
    const rt = getRuntimeContext();
    const rows = await store.loadTodayRows();

    const spentByTenant: Map<string, number> = new Map();
    const spentByRoute: Map<string, number> = new Map();

    for (const r of rows) {
      if (!r.allowed) continue;
      const usd = typeof r.final_cost_usd === "number" ? r.final_cost_usd : r.est_cost_usd;
      spentByTenant.set(r.tenant, (spentByTenant.get(r.tenant) ?? 0) + usd);
      spentByRoute.set(r.route, (spentByRoute.get(r.route) ?? 0) + usd);
    }

    const tenants = rt.tenantByName;
    const routes = rt.routeByName;
    const result: Array<{
      tenant: string;
      route: string;
      spentTodayUsd: number;
      routeDailyCapUsd: number;
      tenantDailyCapUsd: number;
      remainingRouteBudgetUsd: number;
      remainingTenantBudgetUsd: number;
    }> = [];

    for (const route of routes.values()) {
      const tenantName = route.tenant;
      const tenant = tenants.get(tenantName);
      if (!tenant) continue;
      const spentRoute = spentByRoute.get(route.name) ?? 0;
      const spentTenant = spentByTenant.get(tenantName) ?? 0;
      const routeCap = route.policy.budget_daily_usd;
      const tenantCap = tenant.spend.daily_usd_cap;
      result.push({
        tenant: tenantName,
        route: route.name,
        spentTodayUsd: spentRoute,
        routeDailyCapUsd: routeCap,
        tenantDailyCapUsd: tenantCap,
        remainingRouteBudgetUsd: Math.max(0, routeCap - spentRoute),
        remainingTenantBudgetUsd: Math.max(0, tenantCap - spentTenant),
      });
    }

    reply.code(200).send(result);
  });

  app.get("/console/data/telemetry", async (request, reply) => {
    if (!requireSessionOr401(request, reply)) return;
    const raw = String((request.query as any)?.limit ?? "");
    const lim = Math.min(1000, Math.max(1, Number.parseInt(raw || "100", 10) || 100));
    const rows = await store.loadLastRows(lim);
    reply.code(200).send(rows);
  });
}


