import type { ProviderAdapter } from "./types";

export const openaiProvider: ProviderAdapter = {
  name: "openai",
  async invoke(_input: unknown): Promise<unknown> {
    throw new Error("Not implemented: openai provider");
  },
};

