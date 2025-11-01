import type { ParapetSpec } from "./types";

export function validateStructure(spec: ParapetSpec): boolean {
  if (!spec) return false;
  return true;
}
