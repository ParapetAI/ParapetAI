import { ProviderType } from "@parapetai/config-core";

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


export type RouteCache = {
  readonly lru: {
    get(key: string): unknown;
    set(key: string, value: unknown, ttl?: number): void;
    has(key: string): boolean;
    readonly size: number;
  };
  readonly stats: { enabled: boolean; hits: number; misses: number; evictions: number };
};

export type RouteCacheByName = Map<string, RouteCache>;

// API responses

export interface HealthResponse {
  readonly ok: true;
}


export interface APIResponse<T = undefined> {
  statusCode: number;
  error?: string;
  data?: T;
}