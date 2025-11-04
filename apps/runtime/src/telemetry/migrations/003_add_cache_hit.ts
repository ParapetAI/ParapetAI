import type { Database } from "better-sqlite3";

export const MIGRATION_VERSION = 3 as const;

export function up(db: Database): void {
  db.exec(
    [
      "ALTER TABLE telemetry_events ADD COLUMN cache_hit INTEGER DEFAULT 0;",
    ].join("\n")
  );
}


