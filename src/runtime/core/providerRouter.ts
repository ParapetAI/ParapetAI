import type { ProviderAdapter } from "../../providers/types";

export interface ProviderRegistry {
  readonly [name: string]: ProviderAdapter;
}

export function routeToProvider(_registry: ProviderRegistry, _name: string): ProviderAdapter | null {
  return null;
}
