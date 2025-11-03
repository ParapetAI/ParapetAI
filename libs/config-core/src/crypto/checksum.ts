import crypto from "node:crypto";
import type { HydratedConfig } from "../hydration/hydratedTypes";

function stableStringify(value: unknown): string {
  return JSON.stringify(value, function replacer(this: any, key: string, val: any): any {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val).sort()) {
        sorted[k] = val[k];
      }
      return sorted;
    }
    return val;
  });
}

export function computeConfigChecksum(config: HydratedConfig): string {
  const canonical = stableStringify(config);
  const hash = crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
  return hash;
}


