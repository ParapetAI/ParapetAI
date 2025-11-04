import { Database } from "better-sqlite3";
import { MIGRATIONS, type MigrationContext } from "./migrationList";
import { log, LogLevel } from "../util/log";

function ensureSchemaVersionTable(database: Database): void {
  database.exec(
    [
      "CREATE TABLE IF NOT EXISTS schema_version (",
      "  id INTEGER PRIMARY KEY CHECK (id = 1),",
      "  version INTEGER NOT NULL",
      ")",
    ].join("\n")
  );

  const row = database.prepare("SELECT version FROM schema_version WHERE id = 1").get() as
    | { version: number }
    | undefined;
  if (!row) {
    database.prepare("INSERT INTO schema_version (id, version) VALUES (1, 0)").run();
  }
}

function getCurrentVersion(database: Database): number {
  const row = database.prepare("SELECT version FROM schema_version WHERE id = 1").get() as { version: number };
  return row?.version ?? 0;
}

export function runMigrations(database: Database, ctx: MigrationContext): void {
  ensureSchemaVersionTable(database);
  const fromVersion = getCurrentVersion(database);

  const pending = MIGRATIONS.filter((migration) => migration.MIGRATION_VERSION > fromVersion);
  for (const migration of pending) {
    const apply = database.transaction(() => {
      migration.up(database, ctx);
      database.prepare("UPDATE schema_version SET version = ? WHERE id = 1").run(migration.MIGRATION_VERSION);
    });
    apply();
  }

  const toVersion = getCurrentVersion(database);
  log(LogLevel.info, `telemetry migrations applied: ${fromVersion} -> ${toVersion}`);
}


