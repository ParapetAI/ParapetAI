import crypto from "node:crypto";
import type { HydratedConfig, HydratedRoute, HydratedService, HydratedTenant } from "./hydratedTypes";
import type { ParapetSpec, RouteSpec, ServiceSpec, TenantSpec } from "../spec/types";

export interface ResolveRefsOptions {
  readonly prompt?: boolean; // default true
  readonly promptFn?: (label: string) => Promise<string>;
  readonly envGetter?: (name: string) => string | undefined;
}

function getSecretFromEnvFlexible(ref: string, envGetter: (name: string) => string | undefined): string | undefined {
  const trimmed = ref.trim();
  const envPrefix = "ENV:";
  if (trimmed.toUpperCase().startsWith(envPrefix)) {
    const varName = trimmed.slice(envPrefix.length).trim();
    return envGetter(varName);
  }
  const base = trimmed
    .replace(/_ref$/u, "")
    .replace(/[^A-Za-z0-9_]/gu, "_")
    .toUpperCase();
  const direct = envGetter(base);
  if (direct && direct.length > 0) return direct;
  const prefixed = envGetter(`PARAPET_${base}`);
  if (prefixed && prefixed.length > 0) return prefixed;
  return undefined;
}

export async function resolveRefs(spec: ParapetSpec, opts: ResolveRefsOptions = {}): Promise<HydratedConfig> {
  const promptAllowed: boolean = opts.prompt !== false;
  const getEnv = opts.envGetter ?? ((name: string) => process.env[name]);
  const promptFn = opts.promptFn;

  async function resolveRef(ref: string, label: string): Promise<string> {
    const fromEnv: string | undefined = getSecretFromEnvFlexible(ref, getEnv);
    if (fromEnv && fromEnv.length > 0) return fromEnv;
    if (!promptAllowed) {
      throw new Error(`Missing secret for ${label}; expected ${ref}`);
    }
    if (!promptFn) throw new Error(`Cannot prompt for ${label}; no prompt function provided`);
    const value = await promptFn(`${label} (${ref})`);
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
    const fromEnv: string | undefined = getSecretFromEnvFlexible(ref, getEnv);
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

    let hydratedWebhook: HydratedRoute["webhook"] | undefined;
    if ((r as RouteSpec).webhook) {
      const wh = (r as RouteSpec).webhook as NonNullable<RouteSpec["webhook"]>;
      const secret = await resolveRef(wh.secret_ref, `webhook secret for route ${r.name}`);
      const includeSnippet = wh.include_prompt_snippet === true;
      const events = {
        policy_decisions: wh.events?.policy_decisions !== false,
        request_errors: wh.events?.request_errors !== false,
        provider_errors: wh.events?.provider_errors !== false,
      } as const;
      hydratedWebhook = {
        url: wh.url,
        secret,
        include_prompt_snippet: includeSnippet,
        events,
      };
    }

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
        webhook: hydratedWebhook,
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
        webhook: hydratedWebhook,
      });
    }
  }

  const services: HydratedService[] = [];
  for (const s of spec.services) {
    const token = resolveServiceToken(s.parapet_token_ref, s.label);
    services.push({ label: s.label, tenant: s.tenant, allowed_routes: [...s.allowed_routes], parapet_token: token });
  }

  const hydrated: HydratedConfig = {
    version: spec.version,
    tenants,
    routes,
    services,
  };
  return hydrated;
}


