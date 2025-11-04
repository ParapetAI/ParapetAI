import fs from "node:fs";
import Database from "better-sqlite3";
import { hkdfSync } from "node:crypto";
import { log, LogLevel } from "../util/log";
import { open as openStore, type TelemetryStore } from "../telemetry/store";
import { replayTelemetryIntoBudget } from "../telemetry/replay";
import { startWriter } from "../telemetry/writer";
import { decryptBlobToHydratedConfig, computeConfigChecksum, type HydratedConfig } from "@parapetai/config-core";
import { InMemoryVault } from "../vault";
import { initRuntimeContext, indexRoutes, indexServices, indexTenants } from "./state";
import { lru } from "tiny-lru";
import { runMigrations } from "../telemetry/migrate";
import { RouteCacheByName } from "./types";

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
    if (route.webhook?.secret) {
      vault.set(`route:${route.name}:webhook_secret`, route.webhook.secret);
    }
  }

  // Build indices and service key map
  const routeByName = indexRoutes(hydrated.routes);
  const tenantByName = indexTenants(hydrated.tenants);
  const serviceKeyToContext = indexServices(hydrated.services);

  // Initialize per-route caches (opt-in per route)
  const routeCacheByName: RouteCacheByName = new Map();
  
  for (const route of hydrated.routes) {
    const enabled = route.cache?.enabled === true;
    if (!enabled) 
      continue;

    const maxEntries = Math.max(1, Math.floor(route.cache?.max_entries ?? 5000));
    const ttlMs = Math.max(0, Math.floor(route.cache?.ttl_ms ?? 30000));
    const cache = lru(maxEntries, ttlMs);

    routeCacheByName.set(route.name, {
      lru: cache as any,
      stats: { enabled: true, hits: 0, misses: 0, evictions: 0 },
    });
  }

  initRuntimeContext({
    startedAt: Date.now(),
    checksum,
    hydrated,
    vault,
    routeByName,
    tenantByName,
    serviceKeyToContext,
    routeCacheByName,
  });

  // Run DB migrations before opening the telemetry store
  try {
    const master = Buffer.from(masterKey, "utf8");
    const telemetryKey = hkdfSync(
      "sha256",
      master,
      Buffer.from("parapet/v1"),
      Buffer.from("parapet/telemetry/v1"),
      32
    );

    const db = new Database("/data/parapet-telemetry.db", { fileMustExist: false, readonly: false });
    runMigrations(db, { telemetryKey: Buffer.from(telemetryKey) });
    db.close();
  } catch (err) {
    log(LogLevel.error, "Failed to run telemetry DB migrations; refusing to start");
    throw err instanceof Error ? err : new Error(String(err));
  }

  store = openStore("/data/parapet-telemetry.db");
  await replayTelemetryIntoBudget(store);
  startWriter(store);
}
