import type { TelemetryEvent } from "@parapetai/parapet/runtime/telemetry/telemetry";
import { drainBuffer } from "@parapetai/parapet/runtime/telemetry/telemetry";
import type { TelemetryStore } from "@parapetai/parapet/runtime/telemetry/store";

let intervalHandle: ReturnType<typeof setInterval> | undefined;

export function startWriter(store: TelemetryStore, intervalMs: number = 100): void {
  if (intervalHandle) return; // already started
  intervalHandle = setInterval(async () => {
    const batch: readonly TelemetryEvent[] = drainBuffer();
    if (batch.length === 0) return;
    try {
      await store.appendBatch(batch);
    } catch {
      // ignore to avoid crashing the loop; next tick will retry with new events
    }
  }, intervalMs);
}

export function stopWriter(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = undefined;
}

