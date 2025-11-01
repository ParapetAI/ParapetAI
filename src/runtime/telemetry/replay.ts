import type { TelemetryStore } from "./store";
import { rebuildFromRows } from "@parapetai/parapet/runtime/policy/budget";

export async function replayTelemetryIntoBudget(store: TelemetryStore): Promise<void> {
  const rows = await store.loadTodayRows();
  rebuildFromRows(rows);
}

