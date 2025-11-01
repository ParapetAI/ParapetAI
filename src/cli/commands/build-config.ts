import type { ParapetSpec } from "../../config/spec/types";

export async function runBuildConfig(_args: readonly string[]): Promise<void> {
  // prettier-ignore
  console.log("build-config stub: not implemented");
}

export async function buildConfig(_spec: ParapetSpec): Promise<string> {
  throw new Error("Not implemented: build-config");
}

