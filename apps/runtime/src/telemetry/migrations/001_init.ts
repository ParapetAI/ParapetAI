import { Database } from "better-sqlite3";

export const MIGRATION_VERSION = 1 as const;

export function up(db: Database): void {
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS telemetry_events (",
      "  ts INTEGER NOT NULL,",
      "  tenant TEXT NOT NULL,",
      "  route TEXT NOT NULL,",
      "  service_label TEXT NOT NULL,",
      "  allowed INTEGER NOT NULL,",
      "  block_reason TEXT,",
      "  redaction_applied INTEGER NOT NULL,",
      "  drift_strict INTEGER NOT NULL,",
      "  budget_before_usd REAL NOT NULL,",
      "  est_cost_usd REAL NOT NULL,",
      "  final_cost_usd REAL,",
      "  tokens_in INTEGER,",
      "  tokens_out INTEGER,",
      "  latency_ms INTEGER,",
      "  checksum_config TEXT NOT NULL,",
      "  drift_detected INTEGER,",
      "  drift_reason TEXT,",
      "  response_model TEXT,",
      "  system_fingerprint TEXT",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ts ON telemetry_events (ts);",
      "CREATE INDEX IF NOT EXISTS idx_tenant_route_ts ON telemetry_events (tenant, route, ts);",
    ].join("\n")
  );
}


