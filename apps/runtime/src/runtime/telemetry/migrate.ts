import { Database } from "better-sqlite3";
import { MIGRATIONS, type MigrationContext } from "@parapetai/parapet/runtime/telemetry/migrationList";
import { log, LogLevel } from "@parapetai/parapet/runtime/util/log";

function ensureSchemaVersionTable(db: Database): void {
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS schema_version (",
      "  id INTEGER PRIMARY KEY CHECK (id = 1),",
      "  version INTEGER NOT NULL",
      ")",
    ].join("\n")
  );

  const row = db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as
    | { version: number }
    | undefined;
  if (!row) {
    db.prepare("INSERT INTO schema_version (id, version) VALUES (1, 0)").run();
  }
}

function getCurrentVersion(db: Database): number {
  const row = db.prepare("SELECT version FROM schema_version WHERE id = 1").get() as { version: number };
  return row?.version ?? 0;
}

export function runMigrations(db: Database, ctx: MigrationContext): void {
  ensureSchemaVersionTable(db);
  const fromVersion = getCurrentVersion(db);

  const pending = MIGRATIONS.filter((m) => m.MIGRATION_VERSION > fromVersion);
  for (const m of pending) {
    const apply = db.transaction(() => {
      m.up(db, ctx);
      db.prepare("UPDATE schema_version SET version = ? WHERE id = 1").run(m.MIGRATION_VERSION);
    });
    apply();
  }

  const toVersion = getCurrentVersion(db);
  log(LogLevel.info, `telemetry migrations applied: ${fromVersion} -> ${toVersion}`);
}


