import { ProviderType } from "@parapetai/parapet/config/spec/types";

export interface RuntimeRequest {
  readonly routeId: string;
  readonly userId?: string;
  readonly input: unknown;
}

export interface RuntimeResponse {
  readonly output: unknown;
}

export type PolicyDecision =
  | { allowed: false; reason: string; blockMeta?: unknown }
  | {
      allowed: true;
      sanitizedMessages?: Array<{ role: string; content: string }>;
      sanitizedInput?: string | string[];
      routeMeta: { tenant: string; provider: ProviderType; model: string; routeName: string };
      budgetBeforeUsd: number;
      estCostUsd: number;
      redactionApplied: boolean;
      driftStrict: boolean;
    };

// API responses

export interface HealthResponse {
  readonly ok: true;
}


export interface APIResponse<T = undefined> {
  statusCode: number;
  error?: string;
  data?: T;
}