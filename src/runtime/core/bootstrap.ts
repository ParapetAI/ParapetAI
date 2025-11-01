import fs from "node:fs";
import { log, LogLevel } from "@parapetai/parapet/runtime/util/log";
import { open as openStore, type TelemetryStore } from "@parapetai/parapet/runtime/telemetry/store";
import { replayTelemetryIntoBudget } from "@parapetai/parapet/runtime/telemetry/replay";
import { startWriter } from "@parapetai/parapet/runtime/telemetry/writer";
import { decryptBlobToHydratedConfig } from "@parapetai/parapet/config/crypto/blobDecrypt";
import { computeConfigChecksum } from "@parapetai/parapet/config/crypto/checksum";
import type { HydratedConfig } from "@parapetai/parapet/config/hydration/hydratedTypes";

let store: TelemetryStore | undefined;

export async function bootstrapRuntime(): Promise<void> {
  try {
    fs.accessSync("/data", fs.constants.F_OK | fs.constants.W_OK);
  } catch {
    log(LogLevel.error, "/data is required; mount a persistent volume");
    throw new Error("/data is required and must be writable");
  }

  const masterKey = process.env.PARAPET_MASTER_KEY;
  const bootstrap = process.env.PARAPET_BOOTSTRAP_STATE;
  if (!masterKey || !bootstrap) {
    log(LogLevel.error, "PARAPET_MASTER_KEY and PARAPET_BOOTSTRAP_STATE must be set in the environment");
    throw new Error("Missing bootstrap environment variables");
  }

  const hydrated: HydratedConfig = decryptBlobToHydratedConfig(bootstrap, masterKey);
  const checksum = computeConfigChecksum(hydrated);
  log(LogLevel.info, `Config checksum: ${checksum}`);

  store = openStore("/data/parapet-telemetry.db");
  await replayTelemetryIntoBudget(store);
  startWriter(store);
}
