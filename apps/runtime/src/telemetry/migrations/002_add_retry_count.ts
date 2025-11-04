import { Database } from "better-sqlite3";

export const MIGRATION_VERSION = 2 as const;

export function up(db: Database): void {
  db.exec(
    [
      "ALTER TABLE telemetry_events ADD COLUMN retry_count INTEGER;",
    ].join("\n")
  );
}


