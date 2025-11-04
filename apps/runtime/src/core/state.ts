import type { HydratedConfig, HydratedRoute, HydratedTenant, HydratedService } from "@parapetai/config-core";
import { InMemoryVault } from "../vault";
import { RouteCacheByName } from "./types";

export interface ServiceCallerContext {
  readonly serviceLabel: string;
  readonly tenant: string;
  readonly allowedRoutes: readonly string[];
}

export interface RuntimeContext {
  readonly startedAt: number;
  readonly checksum: string;
  readonly hydrated: HydratedConfig;
  readonly vault: InMemoryVault;
  readonly routeByName: ReadonlyMap<string, HydratedRoute>;
  readonly tenantByName: ReadonlyMap<string, HydratedTenant>;
  readonly serviceKeyToContext: ReadonlyMap<string, ServiceCallerContext>;
  readonly routeCacheByName?: RouteCacheByName;
}

let runtimeContext: RuntimeContext | undefined;

export function initRuntimeContext(ctx: RuntimeContext): void {
  runtimeContext = ctx;
}

export function getRuntimeContext(): RuntimeContext {
  if (!runtimeContext) {
    throw new Error("Runtime not bootstrapped");
  }
  return runtimeContext;
}

export function indexRoutes(routes: readonly HydratedRoute[]): ReadonlyMap<string, HydratedRoute> {
  const map = new Map<string, HydratedRoute>();
  for (const r of routes) map.set(r.name, r);
  return map;
}

export function indexTenants(tenants: readonly HydratedTenant[]): ReadonlyMap<string, HydratedTenant> {
  const map = new Map<string, HydratedTenant>();
  for (const t of tenants) map.set(t.name, t);
  return map;
}

export function indexServices(services: readonly HydratedService[]): ReadonlyMap<string, ServiceCallerContext> {
  const map = new Map<string, ServiceCallerContext>();
  for (const s of services) {
    map.set(s.parapet_token, {
      serviceLabel: s.label,
      tenant: s.tenant,
      allowedRoutes: s.allowed_routes,
    });
  }
  return map;
}
