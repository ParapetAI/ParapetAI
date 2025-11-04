import { Database } from "better-sqlite3";
import * as m001 from "./migrations/001_init";
import * as m002 from "./migrations/002_add_retry_count";
import * as m003 from "./migrations/003_add_cache_hit";

export interface MigrationContext {
  telemetryKey: Buffer;
}

export interface MigrationModule {
  readonly MIGRATION_VERSION: number;
  up(db: Database, ctx: MigrationContext): void | Promise<void>;
}

const modules: readonly MigrationModule[] = [
  // 001
  {
    MIGRATION_VERSION: m001.MIGRATION_VERSION,
    up: (db) => m001.up(db),
  },
  // 002
  {
    MIGRATION_VERSION: m002.MIGRATION_VERSION,
    up: (db) => m002.up(db),
  },
  // 003
  {
    MIGRATION_VERSION: m003.MIGRATION_VERSION,
    up: (db) => m003.up(db),
  },
];

export const MIGRATIONS: readonly MigrationModule[] = [...modules].sort(
  (a, b) => a.MIGRATION_VERSION - b.MIGRATION_VERSION
);


