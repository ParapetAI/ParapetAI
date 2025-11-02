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

export type ProviderType = "openai" | "anthropic" | "local";

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
  readonly policy: {
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
}

export interface ServiceSpec {
  readonly label: string;
  readonly tenant: string;
  readonly allowed_routes: readonly string[];
  readonly parapet_token_ref: string;
}

