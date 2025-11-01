import type { HydratedRoute } from "@parapetai/parapet/config/hydration/hydratedTypes";
import type { ProviderType } from "@parapetai/parapet/config/spec/types";

export function checkDriftStrict(
  route: HydratedRoute,
  intended: { provider: ProviderType; model: string }
): { ok: true } | { ok: false; reason: "drift_violation" } {
  if (!route.policy.drift_strict) return { ok: true } as const;
  const sameProvider = route.provider.type === intended.provider;
  const sameModel = route.provider.model === intended.model;
  return sameProvider && sameModel ? ({ ok: true } as const) : ({ ok: false, reason: "drift_violation" } as const);
}
