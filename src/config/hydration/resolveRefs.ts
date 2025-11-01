import type { HydratedConfig } from "./hydratedTypes";
import type { ParapetSpec } from "../spec/types";

export async function resolveRefs(_spec: ParapetSpec): Promise<HydratedConfig> {
  throw new Error("Not implemented: resolveRefs");
}
