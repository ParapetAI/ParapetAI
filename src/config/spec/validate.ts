import type { ParapetSpec, RouteSpec, ServiceSpec, TenantSpec, UserSpec } from "./types";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export function validateRequired(spec: ParapetSpec): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!spec) {
    return { ok: false, issues: [{ path: "", message: "spec is required" }] };
  }
  if (typeof spec.version !== "number") issues.push({ path: "version", message: "version is required and must be a number" });
  if (!Array.isArray(spec.tenants)) issues.push({ path: "tenants", message: "tenants is required" });
  if (!Array.isArray(spec.routes)) issues.push({ path: "routes", message: "routes is required" });
  if (!Array.isArray(spec.services)) issues.push({ path: "services", message: "services is required" });
  if (!Array.isArray(spec.users)) issues.push({ path: "users", message: "users is required" });
  if (issues.length) return { ok: false, issues };
  return { ok: true, issues: [] } as const;
}

export function validateSpec(spec: ParapetSpec): ValidationResult {
  const req = validateRequired(spec);
  if (!req.ok) return req;

  const issues: ValidationIssue[] = [];

  // Tenants
  const tenantNames = new Set<string>();
  for (let i = 0; i < spec.tenants.length; i++) {
    const t: TenantSpec = spec.tenants[i] as TenantSpec;
    if (!t || typeof t.name !== "string" || t.name.trim().length === 0) {
      issues.push({ path: `tenants[${i}].name`, message: "name is required" });
    } else if (tenantNames.has(t.name)) {
      issues.push({ path: `tenants[${i}].name`, message: "duplicate tenant name" });
    } else {
      tenantNames.add(t.name);
    }
    if (!t?.spend || typeof t.spend.daily_usd_cap !== "number" || t.spend.daily_usd_cap < 0) {
      issues.push({ path: `tenants[${i}].spend.daily_usd_cap`, message: "daily_usd_cap must be a non-negative number" });
    }
  }

  // Routes
  const routeNames = new Set<string>();
  for (let i = 0; i < spec.routes.length; i++) {
    const r: RouteSpec = spec.routes[i] as RouteSpec;
    if (!r || typeof r.name !== "string" || r.name.trim().length === 0) {
      issues.push({ path: `routes[${i}].name`, message: "name is required" });
    } else if (routeNames.has(r.name)) {
      issues.push({ path: `routes[${i}].name`, message: "duplicate route name" });
    } else {
      routeNames.add(r.name);
    }
    if (!r?.tenant || !tenantNames.has(r.tenant)) {
      issues.push({ path: `routes[${i}].tenant`, message: "tenant must reference an existing tenant" });
    }
    const p = r?.provider as RouteSpec["provider"];
    if (!p || (p.type !== "openai" && p.type !== "anthropic" && p.type !== "local")) {
      issues.push({ path: `routes[${i}].provider.type`, message: "provider.type must be one of: openai, anthropic, local" });
    }
    if (!p?.model || p.model.trim().length === 0) {
      issues.push({ path: `routes[${i}].provider.model`, message: "provider.model is required" });
    }
    if (!p?.provider_key_ref || p.provider_key_ref.trim().length === 0) {
      issues.push({ path: `routes[${i}].provider.provider_key_ref`, message: "provider_key_ref is required" });
    }
    const pol = r?.policy;
    if (!pol) {
      issues.push({ path: `routes[${i}].policy`, message: "policy is required" });
    } else {
      if (!Number.isFinite(pol.max_tokens_in) || pol.max_tokens_in < 0) issues.push({ path: `routes[${i}].policy.max_tokens_in`, message: "must be a non-negative number" });
      if (!Number.isFinite(pol.max_tokens_out) || pol.max_tokens_out < 0) issues.push({ path: `routes[${i}].policy.max_tokens_out`, message: "must be a non-negative number" });
      if (!Number.isFinite(pol.budget_daily_usd) || pol.budget_daily_usd < 0) issues.push({ path: `routes[${i}].policy.budget_daily_usd`, message: "must be a non-negative number" });
      if (typeof pol.drift_strict !== "boolean") issues.push({ path: `routes[${i}].policy.drift_strict`, message: "must be boolean" });
      const red = pol.redaction;
      if (!red) {
        issues.push({ path: `routes[${i}].policy.redaction`, message: "redaction is required" });
      } else {
        if (red.mode !== "warn" && red.mode !== "block" && red.mode !== "off") {
          issues.push({ path: `routes[${i}].policy.redaction.mode`, message: "must be one of: warn, block, off" });
        }
        if (!Array.isArray(red.patterns)) {
          issues.push({ path: `routes[${i}].policy.redaction.patterns`, message: "patterns must be an array" });
        }
      }
    }
  }

  // Services
  const serviceLabels = new Set<string>();
  for (let i = 0; i < spec.services.length; i++) {
    const s: ServiceSpec = spec.services[i] as ServiceSpec;
    if (!s || typeof s.label !== "string" || s.label.trim().length === 0) {
      issues.push({ path: `services[${i}].label`, message: "label is required" });
    } else if (serviceLabels.has(s.label)) {
      issues.push({ path: `services[${i}].label`, message: "duplicate service label" });
    } else {
      serviceLabels.add(s.label);
    }
    if (!s?.tenant || !tenantNames.has(s.tenant)) {
      issues.push({ path: `services[${i}].tenant`, message: "tenant must reference an existing tenant" });
    }
    if (!Array.isArray(s?.allowed_routes)) {
      issues.push({ path: `services[${i}].allowed_routes`, message: "allowed_routes must be an array" });
    } else {
      for (let j = 0; j < s.allowed_routes.length; j++) {
        const rn = s.allowed_routes[j];
        if (!routeNames.has(rn)) {
          issues.push({ path: `services[${i}].allowed_routes[${j}]`, message: "must reference an existing route name" });
        }
      }
    }
    if (!s?.parapet_token_ref || s.parapet_token_ref.trim().length === 0) {
      issues.push({ path: `services[${i}].parapet_token_ref`, message: "parapet_token_ref is required" });
    }
  }

  // Users
  const usernames = new Set<string>();
  let adminCount = 0;
  for (let i = 0; i < spec.users.length; i++) {
    const u: UserSpec = spec.users[i] as UserSpec;
    if (!u || typeof u.username !== "string" || u.username.trim().length === 0) {
      issues.push({ path: `users[${i}].username`, message: "username is required" });
    } else if (usernames.has(u.username)) {
      issues.push({ path: `users[${i}].username`, message: "duplicate username" });
    } else {
      usernames.add(u.username);
    }
    if (u.role !== "admin" && u.role !== "viewer") {
      issues.push({ path: `users[${i}].role`, message: "role must be 'admin' or 'viewer'" });
    } else if (u.role === "admin") {
      adminCount++;
    }
    if (!u?.password_ref || u.password_ref.trim().length === 0) {
      issues.push({ path: `users[${i}].password_ref`, message: "password_ref is required" });
    }
  }
  if (adminCount < 1) {
    issues.push({ path: "users", message: "at least one admin user is required" });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, issues: [] } as const;
}
