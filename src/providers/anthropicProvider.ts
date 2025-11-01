import type { ProviderAdapter } from "./types";

export const anthropicProvider: ProviderAdapter = {
  name: "anthropic",
  async invoke(_input: unknown): Promise<unknown> {
    throw new Error("Not implemented: anthropic provider");
  },
};

