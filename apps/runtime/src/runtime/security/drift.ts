import type { HydratedRoute, ProviderType} from "@parapetai/config-core";

export function checkDriftStrict(
  route: HydratedRoute,
  intended: { provider: ProviderType; model: string }
): { ok: true } | { ok: false; reason: "drift_violation" } {
  if (!route.policy.drift_strict) return { ok: true } as const;
  const sameProvider = route.provider.type === intended.provider;
  const sameModel = route.provider.model === intended.model;
  return sameProvider && sameModel ? ({ ok: true } as const) : ({ ok: false, reason: "drift_violation" } as const);
}

interface DriftBaseline {
  lastSystemFingerprint?: string;
  sampleCount: number;
}

const baselineMap = new Map<string, DriftBaseline>();

function getBaseline(routeName: string): DriftBaseline | undefined {
  return baselineMap.get(routeName);
}

function updateBaseline(routeName: string, systemFingerprint?: string): void {
  const existing = baselineMap.get(routeName);
  if (existing) {
    if (systemFingerprint) {
      existing.lastSystemFingerprint = systemFingerprint;
    }
    existing.sampleCount += 1;
  } else {
    baselineMap.set(routeName, {
      lastSystemFingerprint: systemFingerprint,
      sampleCount: 1,
    });
  }
}

export interface DriftDetectionResult {
  readonly detected: boolean;
  readonly reason?: string;
}

export function detectDrift(
  route: HydratedRoute,
  expectedModel: string,
  actualCost: number,
  expectedCost: number,
  metadata?: { model?: string; systemFingerprint?: string }
): DriftDetectionResult {
  if (!route.policy.drift_detection.enabled) {
    return { detected: false };
  }

  if (metadata?.model && metadata.model !== expectedModel) {
    return { detected: true, reason: `model_mismatch:${metadata.model}` };
  }

  const baseline = getBaseline(route.name);
  if (metadata?.systemFingerprint && baseline?.lastSystemFingerprint) {
    if (metadata.systemFingerprint !== baseline.lastSystemFingerprint) {
      return { detected: true, reason: `fingerprint_changed:${metadata.systemFingerprint}` };
    }
  }

  if (expectedCost > 0) {
    const costDiff = Math.abs(actualCost - expectedCost) / expectedCost;
    if (costDiff > route.policy.drift_detection.cost_anomaly_threshold) {
      return { detected: true, reason: `cost_anomaly:${(costDiff * 100).toFixed(1)}%` };
    }
  }

  if (metadata?.systemFingerprint) {
    updateBaseline(route.name, metadata.systemFingerprint);
  } else if (baseline) {
    updateBaseline(route.name);
  } else {
    updateBaseline(route.name, metadata?.systemFingerprint);
  }

  return { detected: false };
}