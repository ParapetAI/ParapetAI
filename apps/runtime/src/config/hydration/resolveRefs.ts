import crypto from "node:crypto";
import type { HydratedConfig, HydratedRoute, HydratedService, HydratedTenant, HydratedUser } from "./hydratedTypes";
import type { ParapetSpec, RouteSpec, ServiceSpec, TenantSpec, UserSpec } from "../spec/types";
import { getSecretFromEnv } from "../../cli/secretsources/envSource";
import { promptForSecret } from "../../cli/secretsources/promptSource";

export interface ResolveRefsOptions {
  readonly prompt?: boolean;
}

export async function resolveRefs(spec: ParapetSpec, opts: ResolveRefsOptions = {}): Promise<HydratedConfig> {
  const promptAllowed: boolean = opts.prompt !== false;

  async function resolveRef(ref: string, label: string): Promise<string> {
    const fromEnv: string | undefined = getSecretFromEnv(ref);
    if (fromEnv && fromEnv.length > 0) return fromEnv;
    if (!promptAllowed) {
      throw new Error(`Missing secret for ${label}; set env ${ref.replace(/_ref$/u, "").toUpperCase()}`);
    }
    const value = await promptForSecret(`${label} (${ref})`);
    if (!value || value.length === 0) {
      throw new Error(`Empty secret provided for ${label}`);
    }
    return value;
  }

  function generateToken(): string {
    const raw = crypto.randomBytes(32);
    return raw
      .toString("base64")
      .replace(/=/gu, "")
      .replace(/\+/gu, "-")
      .replace(/\//gu, "_");
  }

  function resolveServiceToken(ref: string, serviceLabel: string): string {
    const fromEnv: string | undefined = getSecretFromEnv(ref);
    if (fromEnv && fromEnv.length > 0) return fromEnv;

    return `parapet-${serviceLabel}-${generateToken()}`;
  }

  const tenants: HydratedTenant[] = spec.tenants.map((t: TenantSpec) => ({
    name: t.name,
    spend: { daily_usd_cap: t.spend.daily_usd_cap },
    notes: t.notes,
  }));

  function getCostThreshold(sensitivity: "low" | "medium" | "high"): number {
    switch (sensitivity) {
      case "low":
        return 0.25;
      case "medium":
        return 0.15;
      case "high":
        return 0.10;
    }
  }

  const routes: HydratedRoute[] = [];
  for (const r of spec.routes) {
    const enabled = r.policy.drift_detection?.enabled ?? r.policy.drift_strict;
    const sensitivity = r.policy.drift_detection?.sensitivity ?? "medium";
    const costThreshold = r.policy.drift_detection?.cost_anomaly_threshold ?? getCostThreshold(sensitivity);

    const driftDetection = {
      enabled,
      sensitivity,
      cost_anomaly_threshold: costThreshold,
    };

    if (r.provider.type === "local") {
      routes.push({
        name: r.name,
        tenant: r.tenant,
        provider: {
          type: r.provider.type,
          model: r.provider.model,
          endpoint_type: r.provider.endpoint_type ?? "chat_completions",
          endpoint: r.provider.endpoint,
          default_params: r.provider.default_params,
        },
        policy: {
          max_tokens_in: r.policy.max_tokens_in,
          max_tokens_out: r.policy.max_tokens_out,
          budget_daily_usd: r.policy.budget_daily_usd,
          drift_strict: r.policy.drift_strict,
          drift_detection: driftDetection,
          redaction: { mode: r.policy.redaction.mode, patterns: r.policy.redaction.patterns },
        },
      });
    } else {
      const key = await resolveRef(r.provider.provider_key_ref as string, `provider_key for route ${r.name}`);
      routes.push({
        name: r.name,
        tenant: r.tenant,
        provider: {
          type: r.provider.type,
          model: r.provider.model,
          endpoint_type: r.provider.endpoint_type ?? "chat_completions",
          provider_key: key,
          default_params: r.provider.default_params,
        },
        policy: {
          max_tokens_in: r.policy.max_tokens_in,
          max_tokens_out: r.policy.max_tokens_out,
          budget_daily_usd: r.policy.budget_daily_usd,
          drift_strict: r.policy.drift_strict,
          drift_detection: driftDetection,
          redaction: { mode: r.policy.redaction.mode, patterns: r.policy.redaction.patterns },
        },
      });
    }
  }

  const services: HydratedService[] = [];
  for (const s of spec.services) {
    const token = resolveServiceToken(s.parapet_token_ref, s.label);
    services.push({ label: s.label, tenant: s.tenant, allowed_routes: [...s.allowed_routes], parapet_token: token });
  }

  const users: HydratedUser[] = [];
  for (const u of spec.users) {
    const pwd = await resolveRef(u.password_ref, `password for user ${u.username}`);
    users.push({ username: u.username, role: u.role, password_plaintext: pwd });
  }

  const hydrated: HydratedConfig = {
    version: spec.version,
    tenants,
    routes,
    services,
    users,
  };
  return hydrated;
}
