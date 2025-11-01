import type { ProviderAdapter } from "./types";

export const localProvider: ProviderAdapter = {
  name: "local",
  async invoke(input: unknown): Promise<unknown> {
    return input;
  },
};

