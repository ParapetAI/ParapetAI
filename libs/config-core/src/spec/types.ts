export interface ParapetSpec {
  readonly version: number;
  readonly tenants: readonly TenantSpec[];
  readonly routes: readonly RouteSpec[];
  readonly services: readonly ServiceSpec[];
}

export interface TenantSpec {
  readonly name: string;
  readonly spend: {
    readonly daily_usd_cap: number;
  };
  readonly notes?: string;
}

export type ProviderType = "openai" | "local";

export type EndpointType = "chat_completions" | "embeddings";

export interface RouteSpec {
  readonly name: string;
  readonly tenant: string;
  readonly provider: {
    readonly type: ProviderType;
    readonly model: string;
    readonly endpoint_type?: EndpointType; // defaults to chat_completions
    readonly provider_key_ref?: string; // required for non-local providers
    readonly endpoint?: string; // required for local provider
    readonly default_params?: Readonly<Record<string, unknown>>; // route-level parameter defaults
  };
  readonly policy?: {
    readonly max_tokens_in: number;
    readonly max_tokens_out: number;
    readonly budget_daily_usd: number;
    readonly drift_strict: boolean;
    readonly drift_detection?: {
      readonly enabled?: boolean; // defaults to drift_strict value
      readonly sensitivity?: "low" | "medium" | "high"; // defaults to "medium"
      readonly cost_anomaly_threshold?: number; // defaults based on sensitivity
    };
    readonly redaction: {
      readonly mode: "warn" | "block" | "off";
      readonly patterns: readonly string[];
    };
  };
  readonly retries?: {
    readonly max_attempts: number; // 2..5
    readonly base_ms: number; // 100..1000
    readonly jitter: boolean; // full jitter when true
    readonly retry_on: readonly number[]; // subset of [429,500,502,503,504]
    readonly max_elapsed_ms: number; // >= base_ms
  };
  readonly cache?: {
    readonly enabled?: boolean;
    readonly mode?: "exact"; // reserved for future semantic modes
    readonly ttl_ms?: number; // default: 30000
    readonly max_entries?: number; // default: 5000
    readonly include_params?: boolean; // default: true
  };
  readonly webhook?: {
    readonly url: string;
    readonly secret_ref: string;
    readonly include_prompt_snippet?: boolean;
    readonly events?: {
      readonly policy_decisions?: boolean;
      readonly request_errors?: boolean;
      readonly provider_errors?: boolean;
    };
  };
}

export interface ServiceSpec {
  readonly label: string;
  readonly tenant: string;
  readonly allowed_routes: readonly string[];
  readonly parapet_token_ref: string;
}


