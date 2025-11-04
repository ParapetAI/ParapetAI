import type { ParapetSpec, RouteSpec, ServiceSpec, TenantSpec } from "./types";

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
    const routeSpec: RouteSpec = spec.routes[i] as RouteSpec;

    if (!routeSpec || typeof routeSpec.name !== "string" || routeSpec.name.trim().length === 0) {
      issues.push({ path: `routes[${i}].name`, message: "name is required" });
    } else if (routeNames.has(routeSpec.name)) {
      issues.push({ path: `routes[${i}].name`, message: "duplicate route name" });
    } else {
      routeNames.add(routeSpec.name);
    }

    if (!routeSpec?.tenant || !tenantNames.has(routeSpec.tenant)) {
      issues.push({ path: `routes[${i}].tenant`, message: "tenant must reference an existing tenant" });
    }

    const provider = routeSpec?.provider as RouteSpec["provider"];
    if (!provider || (provider.type !== "openai" && provider.type !== "local")) {
      issues.push({ path: `routes[${i}].provider.type`, message: "provider.type must be one of: openai, local" });
    }
    if (!provider?.model || provider.model.trim().length === 0) {
      issues.push({ path: `routes[${i}].provider.model`, message: "provider.model is required" });
    }
    if (provider?.type === "local") {
      if (!provider?.endpoint || provider.endpoint.trim().length === 0) {
        issues.push({ path: `routes[${i}].provider.endpoint`, message: "endpoint is required for local provider" });
      }
    } else {
      if (!provider?.provider_key_ref || provider.provider_key_ref.trim().length === 0) {
        issues.push({ path: `routes[${i}].provider.provider_key_ref`, message: "provider_key_ref is required for non-local providers" });
      }
      if (!provider?.endpoint || provider.endpoint.trim().length === 0) {
        issues.push({ path: `routes[${i}].provider.endpoint`, message: "endpoint is required for non-local providers" });
      }
    }

    const policy = routeSpec?.policy;
    if (policy) {
      if (!Number.isFinite(policy.max_tokens_in) || policy.max_tokens_in < 0) issues.push({ path: `routes[${i}].policy.max_tokens_in`, message: "must be a non-negative number" });
      if (!Number.isFinite(policy.max_tokens_out) || policy.max_tokens_out < 0) issues.push({ path: `routes[${i}].policy.max_tokens_out`, message: "must be a non-negative number" });
      if (!Number.isFinite(policy.budget_daily_usd) || policy.budget_daily_usd < 0) issues.push({ path: `routes[${i}].policy.budget_daily_usd`, message: "must be a non-negative number" });
      if (typeof policy.drift_strict !== "boolean") issues.push({ path: `routes[${i}].policy.drift_strict`, message: "must be boolean" });
      const driftDetection = policy.drift_detection;
      if (driftDetection !== undefined) {
        if (driftDetection.enabled !== undefined && typeof driftDetection.enabled !== "boolean") {
          issues.push({ path: `routes[${i}].policy.drift_detection.enabled`, message: "must be boolean" });
        }
        if (driftDetection.sensitivity !== undefined) {
          if (driftDetection.sensitivity !== "low" && driftDetection.sensitivity !== "medium" && driftDetection.sensitivity !== "high") {
            issues.push({ path: `routes[${i}].policy.drift_detection.sensitivity`, message: "must be one of: low, medium, high" });
          }
        }
        if (driftDetection.cost_anomaly_threshold !== undefined) {
          if (!Number.isFinite(driftDetection.cost_anomaly_threshold) || driftDetection.cost_anomaly_threshold < 0 || driftDetection.cost_anomaly_threshold > 1) {
            issues.push({ path: `routes[${i}].policy.drift_detection.cost_anomaly_threshold`, message: "must be a number between 0 and 1" });
          }
        }
      }

      const redaction = policy.redaction;
      if (!redaction) {
        issues.push({ path: `routes[${i}].policy.redaction`, message: "redaction is required" });
      } else {
        if (redaction.mode !== "warn" && redaction.mode !== "block" && redaction.mode !== "off") {
          issues.push({ path: `routes[${i}].policy.redaction.mode`, message: "must be one of: warn, block, off" });
        }
        if (!Array.isArray(redaction.patterns)) {
          issues.push({ path: `routes[${i}].policy.redaction.patterns`, message: "patterns must be an array" });
        }
      }
    }

    // Cache (optional)
    const cache = routeSpec.cache as RouteSpec["cache"] | undefined;
    if (cache !== undefined) {
      const base = `routes[${i}].cache`;
      if (cache.enabled !== undefined && typeof cache.enabled !== "boolean") {
        issues.push({ path: `${base}.enabled`, message: "must be boolean" });
      }
      if (cache.mode !== undefined && cache.mode !== "exact") {
        issues.push({ path: `${base}.mode`, message: "must be \"exact\"" });
      }
      if (cache.ttl_ms !== undefined && (!Number.isFinite(cache.ttl_ms) || cache.ttl_ms < 0)) {
        issues.push({ path: `${base}.ttl_ms`, message: "must be a non-negative number" });
      }
      if (cache.max_entries !== undefined && (!Number.isFinite(cache.max_entries) || cache.max_entries < 1)) {
        issues.push({ path: `${base}.max_entries`, message: "must be a positive integer" });
      }
      if (cache.include_params !== undefined && typeof cache.include_params !== "boolean") {
        issues.push({ path: `${base}.include_params`, message: "must be boolean" });
      }
    }

    // Retries at route level (optional)
    const retries = (routeSpec as RouteSpec).retries as {
      max_attempts?: number;
      base_ms?: number;
      jitter?: boolean;
      retry_on?: readonly number[];
      max_elapsed_ms?: number;
    } | undefined;
    if (retries !== undefined) {
      const pathBase = `routes[${i}].retries`;
      const requiredFields: Array<keyof typeof retries> = [
        "max_attempts",
        "base_ms",
        "jitter",
        "retry_on",
        "max_elapsed_ms",
      ];
      for (const f of requiredFields) {
        if (retries[f] === undefined) {
          issues.push({ path: `${pathBase}.${String(f)}`, message: "is required" });
        }
      }
      if (typeof retries.max_attempts !== "number" || retries.max_attempts < 2 || retries.max_attempts > 5) {
        issues.push({ path: `${pathBase}.max_attempts`, message: "must be a number between 2 and 5" });
      }
      if (typeof retries.base_ms !== "number" || retries.base_ms < 100 || retries.base_ms > 1000) {
        issues.push({ path: `${pathBase}.base_ms`, message: "must be a number between 100 and 1000" });
      }
      if (typeof retries.jitter !== "boolean") {
        issues.push({ path: `${pathBase}.jitter`, message: "must be boolean" });
      }
      const allowedStatuses = new Set([429, 500, 502, 503, 504]);
      if (!Array.isArray(retries.retry_on) || retries.retry_on.length === 0) {
        issues.push({ path: `${pathBase}.retry_on`, message: "must be a non-empty array of HTTP statuses" });
      } else {
        for (let j = 0; j < retries.retry_on.length; j++) {
          const code = retries.retry_on[j];
          if (typeof code !== "number" || !allowedStatuses.has(code)) {
            issues.push({ path: `${pathBase}.retry_on[${j}]`, message: "must be one of: 429, 500, 502, 503, 504" });
          }
        }
      }
      if (typeof retries.max_elapsed_ms !== "number" || retries.max_elapsed_ms < (retries.base_ms ?? 0)) {
        issues.push({ path: `${pathBase}.max_elapsed_ms`, message: "must be >= base_ms" });
      }
    }

    const webhook = (routeSpec as RouteSpec).webhook as RouteSpec["webhook"] | undefined;
    if (webhook !== undefined) {
      if (!webhook || typeof webhook.url !== "string" || webhook.url.trim().length === 0) {
        issues.push({ path: `routes[${i}].webhook.url`, message: "url is required and must be a non-empty string" });
      }
      if (!webhook || typeof webhook.secret_ref !== "string" || webhook.secret_ref.trim().length === 0) {
        issues.push({ path: `routes[${i}].webhook.secret_ref`, message: "secret_ref is required and must be a non-empty string" });
      }
      if (webhook.include_prompt_snippet !== undefined && typeof webhook.include_prompt_snippet !== "boolean") {
        issues.push({ path: `routes[${i}].webhook.include_prompt_snippet`, message: "must be boolean" });
      }
      if (webhook.events !== undefined) {
        const events = webhook.events!;
        if (events.policy_decisions !== undefined && typeof events.policy_decisions !== "boolean") {
          issues.push({ path: `routes[${i}].webhook.events.policy_decisions`, message: "must be boolean" });
        }
        if (events.request_errors !== undefined && typeof events.request_errors !== "boolean") {
          issues.push({ path: `routes[${i}].webhook.events.request_errors`, message: "must be boolean" });
        }
        if (events.provider_errors !== undefined && typeof events.provider_errors !== "boolean") {
          issues.push({ path: `routes[${i}].webhook.events.provider_errors`, message: "must be boolean" });
        }
      }
    }
  }

  // Services
  const serviceLabels = new Set<string>();
  for (let i = 0; i < spec.services.length; i++) {
    const serviceSpec: ServiceSpec = spec.services[i] as ServiceSpec;
    if (!serviceSpec || typeof serviceSpec.label !== "string" || serviceSpec.label.trim().length === 0) {
      issues.push({ path: `services[${i}].label`, message: "label is required" });
    } else if (serviceLabels.has(serviceSpec.label)) {
      issues.push({ path: `services[${i}].label`, message: "duplicate service label" });
    } else {
      serviceLabels.add(serviceSpec.label);
    }
    if (!serviceSpec?.tenant || !tenantNames.has(serviceSpec.tenant)) {
      issues.push({ path: `services[${i}].tenant`, message: "tenant must reference an existing tenant" });
    }
    if (!Array.isArray(serviceSpec?.allowed_routes)) {
      issues.push({ path: `services[${i}].allowed_routes`, message: "allowed_routes must be an array" });
    } else {
      for (let j = 0; j < serviceSpec.allowed_routes.length; j++) {
        const routeName = serviceSpec.allowed_routes[j];
        if (!routeNames.has(routeName)) {
          issues.push({ path: `services[${i}].allowed_routes[${j}]`, message: "must reference an existing route name" });
        }
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, issues: [] } as const;
}


