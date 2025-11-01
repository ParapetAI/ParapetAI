import Database from "better-sqlite3";
import type { TelemetryEvent } from "@parapetai/parapet/runtime/telemetry/telemetry";

export interface TelemetryStore {
  appendBatch(events: readonly TelemetryEvent[]): Promise<void>;
  loadTodayRows(): Promise<readonly TelemetryEvent[]>;
}

type SqliteDb = any;

function initSchema(db: SqliteDb): void {
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
      "  checksum_config TEXT NOT NULL",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ts ON telemetry_events (ts);",
      "CREATE INDEX IF NOT EXISTS idx_tenant_route_ts ON telemetry_events (tenant, route, ts);",
    ].join("\n")
  );
}

function getUtcStartOfDay(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  return Date.UTC(year, month, date);
}

export function open(dbPath: string = "/data/parapet-telemetry.db"): TelemetryStore {
  const db = new Database(dbPath, { fileMustExist: false, readonly: false });
  initSchema(db);

  const insertStmt = db.prepare(
    [
      "INSERT INTO telemetry_events (",
      "  ts, tenant, route, service_label, allowed, block_reason,",
      "  redaction_applied, drift_strict, budget_before_usd, est_cost_usd, final_cost_usd,",
      "  tokens_in, tokens_out, latency_ms, checksum_config",
      ") VALUES (",
      "  @ts, @tenant, @route, @service_label, @allowed, @block_reason,",
      "  @redaction_applied, @drift_strict, @budget_before_usd, @est_cost_usd, @final_cost_usd,",
      "  @tokens_in, @tokens_out, @latency_ms, @checksum_config",
      ")",
    ].join("\n")
  );

  const insertMany = db.transaction((events: readonly TelemetryEvent[]) => {
    for (const e of events) {
      insertStmt.run({
        ts: e.ts,
        tenant: e.tenant,
        route: e.route,
        service_label: e.service_label,
        allowed: e.allowed ? 1 : 0,
        block_reason: e.block_reason ?? null,
        redaction_applied: e.redaction_applied ? 1 : 0,
        drift_strict: e.drift_strict ? 1 : 0,
        budget_before_usd: e.budget_before_usd,
        est_cost_usd: e.est_cost_usd,
        final_cost_usd: e.final_cost_usd ?? null,
        tokens_in: e.tokens_in ?? null,
        tokens_out: e.tokens_out ?? null,
        latency_ms: e.latency_ms ?? null,
        checksum_config: e.checksum_config,
      });
    }
  });

  async function appendBatch(events: readonly TelemetryEvent[]): Promise<void> {
    if (!events.length) return;
    insertMany(events);
  }

  async function loadTodayRows(): Promise<readonly TelemetryEvent[]> {
    const start = getUtcStartOfDay();
    const rows = db
      .prepare(
        "SELECT ts, tenant, route, service_label, allowed, block_reason, redaction_applied, drift_strict, budget_before_usd, est_cost_usd, final_cost_usd, tokens_in, tokens_out, latency_ms, checksum_config FROM telemetry_events WHERE ts >= ? ORDER BY ts ASC"
      )
      .all(start) as Array<{
      ts: number;
      tenant: string;
      route: string;
      service_label: string;
      allowed: number;
      block_reason: string | null;
      redaction_applied: number;
      drift_strict: number;
      budget_before_usd: number;
      est_cost_usd: number;
      final_cost_usd: number | null;
      tokens_in: number | null;
      tokens_out: number | null;
      latency_ms: number | null;
      checksum_config: string;
    }>;

    return rows.map((r) => ({
      ts: r.ts,
      tenant: r.tenant,
      route: r.route,
      service_label: r.service_label,
      allowed: r.allowed === 1,
      block_reason: r.block_reason ?? undefined,
      redaction_applied: r.redaction_applied === 1,
      drift_strict: r.drift_strict === 1,
      budget_before_usd: r.budget_before_usd,
      est_cost_usd: r.est_cost_usd,
      final_cost_usd: r.final_cost_usd ?? undefined,
      tokens_in: r.tokens_in ?? undefined,
      tokens_out: r.tokens_out ?? undefined,
      latency_ms: r.latency_ms ?? undefined,
      checksum_config: r.checksum_config,
    }));
  }

  return { appendBatch, loadTodayRows };
}

