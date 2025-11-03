import { Database } from "better-sqlite3";
import * as m001 from "./migrations/001_init";

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
];

export const MIGRATIONS: readonly MigrationModule[] = [...modules].sort(
  (a, b) => a.MIGRATION_VERSION - b.MIGRATION_VERSION
);


