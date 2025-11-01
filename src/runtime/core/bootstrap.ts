import fs from "node:fs";
import { log, LogLevel } from "@parapetai/parapet/runtime/util/log";
import { open as openStore, type TelemetryStore } from "@parapetai/parapet/runtime/telemetry/store";
import { replayTelemetryIntoBudget } from "@parapetai/parapet/runtime/telemetry/replay";
import { startWriter } from "@parapetai/parapet/runtime/telemetry/writer";

let store: TelemetryStore | undefined;

export async function bootstrapRuntime(): Promise<void> {
  try {
    fs.accessSync("/data", fs.constants.F_OK | fs.constants.W_OK);
  } catch {
    log(LogLevel.error, "/data is required; mount a persistent volume");
    throw new Error("/data is required and must be writable");
  }

  store = openStore("/data/parapet-telemetry.db");
  await replayTelemetryIntoBudget(store);
  startWriter(store);
}
