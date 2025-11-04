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
  for (const route of spec.routes) {
    const hasPolicy = Boolean(route.policy);
    const rawPolicy = route.policy;
    const enabled = rawPolicy?.drift_detection?.enabled ?? rawPolicy?.drift_strict ?? false;
    const sensitivity = rawPolicy?.drift_detection?.sensitivity ?? "medium";
    const costThreshold = rawPolicy?.drift_detection?.cost_anomaly_threshold ?? getCostThreshold(sensitivity);

    const driftDetection = {
      enabled,
      sensitivity,
      cost_anomaly_threshold: costThreshold,
    };

    let hydratedWebhook: HydratedRoute["webhook"] | undefined;
    if ((route as RouteSpec).webhook) {
      const wh = (route as RouteSpec).webhook as NonNullable<RouteSpec["webhook"]>;
      const secret = await resolveRef(wh.secret_ref, `webhook secret for route ${route.name}`);
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

    const hydratedCache = {
      enabled: route.cache?.enabled === true,
      mode: "exact" as const,
      ttl_ms: route.cache?.ttl_ms ?? 30000,
      max_entries: route.cache?.max_entries ?? 5000,
      include_params: route.cache?.include_params !== false,
    };

    if (route.provider.type === "local") {
      routes.push({
        name: route.name,
        tenant: route.tenant,
        provider: {
          type: route.provider.type,
          model: route.provider.model,
          endpoint_type: route.provider.endpoint_type ?? "chat_completions",
          endpoint: route.provider.endpoint,
          default_params: route.provider.default_params,
        },
        ...(hasPolicy
          ? {
              policy: {
                max_tokens_in: rawPolicy!.max_tokens_in,
                max_tokens_out: rawPolicy!.max_tokens_out,
                budget_daily_usd: rawPolicy!.budget_daily_usd,
                drift_strict: rawPolicy!.drift_strict,
                drift_detection: driftDetection,
                redaction: { mode: rawPolicy!.redaction.mode, patterns: rawPolicy!.redaction.patterns },
              },
            }
          : {}),
        retries: route.retries,
        cache: hydratedCache,
        webhook: hydratedWebhook,
      });
    } else {
      const key = await resolveRef(route.provider.provider_key_ref as string, `provider_key for route ${route.name}`);
      routes.push({
        name: route.name,
        tenant: route.tenant,
        provider: {
          type: route.provider.type,
          model: route.provider.model,
          endpoint_type: route.provider.endpoint_type ?? "chat_completions",
          provider_key: key,
          endpoint: route.provider.endpoint,
          default_params: route.provider.default_params,
        },
        ...(hasPolicy
          ? {
              policy: {
                max_tokens_in: rawPolicy!.max_tokens_in,
                max_tokens_out: rawPolicy!.max_tokens_out,
                budget_daily_usd: rawPolicy!.budget_daily_usd,
                drift_strict: rawPolicy!.drift_strict,
                drift_detection: driftDetection,
                redaction: { mode: rawPolicy!.redaction.mode, patterns: rawPolicy!.redaction.patterns },
              },
            }
          : {}),
        retries: route.retries,
        cache: hydratedCache,
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


