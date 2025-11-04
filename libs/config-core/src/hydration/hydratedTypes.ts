import type { ParapetSpec, ProviderType, EndpointType } from "../spec/types";

export interface HydratedConfig {
  readonly version: number;
  readonly tenants: readonly HydratedTenant[];
  readonly routes: readonly HydratedRoute[];
  readonly services: readonly HydratedService[];
}

export interface HydratedTenant {
  readonly name: string;
  readonly spend: {
    readonly daily_usd_cap: number;
  };
  readonly notes?: string;
}

export interface HydratedRoute {
  readonly name: string;
  readonly tenant: string;
  readonly provider: {
    readonly type: ProviderType;
    readonly model: string;
    readonly endpoint_type: EndpointType; // defaults to chat_completions
    readonly provider_key?: string; // resolved from provider_key_ref (non-local)
    readonly endpoint?: string; // for local providers
    readonly default_params?: Readonly<Record<string, unknown>>; // route-level parameter defaults
  };
  readonly policy?: {
    readonly max_tokens_in: number;
    readonly max_tokens_out: number;
    readonly budget_daily_usd: number;
    readonly drift_strict: boolean;
    readonly drift_detection: {
      readonly enabled: boolean;
      readonly sensitivity: "low" | "medium" | "high";
      readonly cost_anomaly_threshold: number;
    };
    readonly redaction: {
      readonly mode: "warn" | "block" | "off";
      readonly patterns: readonly string[];
    };
  };
  readonly retries?: {
    readonly max_attempts: number;
    readonly base_ms: number;
    readonly jitter: boolean;
    readonly retry_on: readonly number[];
    readonly max_elapsed_ms: number;
  };
  readonly cache?: {
    readonly enabled: boolean;
    readonly mode: "exact";
    readonly ttl_ms: number;
    readonly max_entries: number;
    readonly include_params: boolean;
  };
  readonly webhook?: {
    readonly url: string;
    readonly secret: string;
    readonly include_prompt_snippet: boolean;
    readonly events: {
      readonly policy_decisions: boolean;
      readonly request_errors: boolean;
      readonly provider_errors: boolean;
    };
  };
}

export interface HydratedService {
  readonly label: string;
  readonly tenant: string;
  readonly allowed_routes: readonly string[];
  readonly parapet_token: string; // resolved from parapet_token_ref
}


