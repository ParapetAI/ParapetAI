import fs from "node:fs";
import { log, LogLevel } from "@parapetai/parapet/runtime/util/log";
import { open as openStore, type TelemetryStore } from "@parapetai/parapet/runtime/telemetry/store";
import { replayTelemetryIntoBudget } from "@parapetai/parapet/runtime/telemetry/replay";
import { startWriter } from "@parapetai/parapet/runtime/telemetry/writer";
import { decryptBlobToHydratedConfig } from "@parapetai/parapet/config/crypto/blobDecrypt";
import { computeConfigChecksum } from "@parapetai/parapet/config/crypto/checksum";
import type { HydratedConfig } from "@parapetai/parapet/config/hydration/hydratedTypes";
import { InMemoryVault } from "@parapetai/parapet/runtime/vault";
import { initRuntimeContext, indexRoutes, indexServices, indexTenants } from "@parapetai/parapet/runtime/core/state";

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

  // Initialize vault with provider keys per route (for providers that use keys)
  const vault = new InMemoryVault();
  for (const route of hydrated.routes) {
    if (route.provider.provider_key) {
      vault.set(`route:${route.name}:provider_key`, route.provider.provider_key);
    }
  }

  // Build indices and service key map
  const routeByName = indexRoutes(hydrated.routes);
  const tenantByName = indexTenants(hydrated.tenants);
  const serviceKeyToContext = indexServices(hydrated.services);

  initRuntimeContext({
    startedAt: Date.now(),
    checksum,
    hydrated,
    vault,
    routeByName,
    tenantByName,
    serviceKeyToContext,
  });

  store = openStore("/data/parapet-telemetry.db");
  await replayTelemetryIntoBudget(store);
  startWriter(store);
}
