import type { ParapetSpec, ProviderType } from "../spec/types";

export interface HydratedConfig {
  readonly version: number;
  readonly tenants: readonly HydratedTenant[];
  readonly routes: readonly HydratedRoute[];
  readonly services: readonly HydratedService[];
  readonly users: readonly HydratedUser[];
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
    readonly provider_key?: string; // resolved from provider_key_ref (non-local)
    readonly endpoint?: string; // for local providers
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

export interface HydratedService {
  readonly label: string;
  readonly tenant: string;
  readonly allowed_routes: readonly string[];
  readonly parapet_token: string; // resolved from parapet_token_ref
}

export interface HydratedUser {
  readonly username: string;
  readonly role: "admin" | "viewer";
  readonly password_plaintext: string; // resolved from password_ref
}
