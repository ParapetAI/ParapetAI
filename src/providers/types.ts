import type { ProviderName } from "../config/constants";

export interface ProviderAdapter {
  readonly name: ProviderName;
  invoke(input: unknown): Promise<unknown>;
}

