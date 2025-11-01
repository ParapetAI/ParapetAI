export interface ParapetSpec {
  readonly version: number;
  readonly tenants: readonly TenantSpec[];
  readonly routes: readonly RouteSpec[];
  readonly services: readonly ServiceSpec[];
  readonly users: readonly UserSpec[];
}

export interface TenantSpec {
  readonly name: string;
  readonly spend: {
    readonly daily_usd_cap: number;
  };
  readonly notes?: string;
}

export type ProviderType = "openai" | "anthropic" | "local";

export interface RouteSpec {
  readonly name: string;
  readonly tenant: string;
  readonly provider: {
    readonly type: ProviderType;
    readonly model: string;
    readonly provider_key_ref: string;
  };
  readonly policy: {
    readonly max_tokens_in: number;
    readonly max_tokens_out: number;
    readonly budget_daily_usd: number;
    readonly drift_strict: boolean;
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

export interface UserSpec {
  readonly username: string;
  readonly role: "admin" | "viewer";
  readonly password_ref: string;
}
