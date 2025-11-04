import Database from "better-sqlite3";
import type { TelemetryEvent } from "./telemetry";

export interface TelemetryStore {
  appendBatch(events: readonly TelemetryEvent[]): Promise<void>;
  loadTodayRows(): Promise<readonly TelemetryEvent[]>;
  loadLastRows(limit: number): Promise<readonly TelemetryEvent[]>;
}

type SqliteDb = any;

function getUtcStartOfDay(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  return Date.UTC(year, month, date);
}

export function open(dbPath: string = "/data/parapet-telemetry.db"): TelemetryStore {
  const database = new Database(dbPath, { fileMustExist: false, readonly: false });

  const insertStmt = database.prepare(
    [
      "INSERT INTO telemetry_events (",
      "  ts, tenant, route, service_label, allowed, block_reason,",
      "  redaction_applied, drift_strict, budget_before_usd, est_cost_usd, final_cost_usd,",
      "  tokens_in, tokens_out, latency_ms, retry_count, checksum_config,",
      "  drift_detected, drift_reason, response_model, system_fingerprint, cache_hit",
      ") VALUES (",
      "  @ts, @tenant, @route, @service_label, @allowed, @block_reason,",
      "  @redaction_applied, @drift_strict, @budget_before_usd, @est_cost_usd, @final_cost_usd,",
      "  @tokens_in, @tokens_out, @latency_ms, @retry_count, @checksum_config,",
      "  @drift_detected, @drift_reason, @response_model, @system_fingerprint, @cache_hit",
      ")",
    ].join("\n")
  );

  const insertMany = database.transaction((events: readonly TelemetryEvent[]) => {
    for (const event of events) {
      insertStmt.run({
        ts: event.ts,
        tenant: event.tenant,
        route: event.route,
        service_label: event.service_label,
        allowed: event.allowed ? 1 : 0,
        block_reason: event.block_reason ?? null,
        redaction_applied: event.redaction_applied ? 1 : 0,
        drift_strict: event.drift_strict ? 1 : 0,
        budget_before_usd: event.budget_before_usd,
        est_cost_usd: event.est_cost_usd,
        final_cost_usd: event.final_cost_usd ?? null,
        tokens_in: event.tokens_in ?? null,
        tokens_out: event.tokens_out ?? null,
        latency_ms: event.latency_ms ?? null,
        retry_count: event.retry_count ?? null,
        checksum_config: event.checksum_config,
        drift_detected: event.drift_detected !== undefined ? (event.drift_detected ? 1 : 0) : null,
        drift_reason: event.drift_reason ?? null,
        response_model: event.response_model ?? null,
        system_fingerprint: event.system_fingerprint ?? null,
        cache_hit: event.cache_hit !== undefined ? (event.cache_hit ? 1 : 0) : null,
      });
    }
  });

  async function appendBatch(events: readonly TelemetryEvent[]): Promise<void> {
    if (!events.length) return;
    insertMany(events);
  }

  async function loadTodayRows(): Promise<readonly TelemetryEvent[]> {
    const start = getUtcStartOfDay();
    const rows = database
      .prepare(
        "SELECT ts, tenant, route, service_label, allowed, block_reason, redaction_applied, drift_strict, budget_before_usd, est_cost_usd, final_cost_usd, tokens_in, tokens_out, latency_ms, retry_count, checksum_config, drift_detected, drift_reason, response_model, system_fingerprint, cache_hit FROM telemetry_events WHERE ts >= ? ORDER BY ts ASC"
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
      retry_count: number | null;
      checksum_config: string;
      drift_detected: number | null;
      drift_reason: string | null;
      response_model: string | null;
      system_fingerprint: string | null;
      cache_hit: number | null;
    }>;

    return rows.map((row) => ({
      ts: row.ts,
      tenant: row.tenant,
      route: row.route,
      service_label: row.service_label,
      allowed: row.allowed === 1,
      block_reason: row.block_reason ?? undefined,
      redaction_applied: row.redaction_applied === 1,
      drift_strict: row.drift_strict === 1,
      budget_before_usd: row.budget_before_usd,
      est_cost_usd: row.est_cost_usd,
      final_cost_usd: row.final_cost_usd ?? undefined,
      tokens_in: row.tokens_in ?? undefined,
      tokens_out: row.tokens_out ?? undefined,
      latency_ms: row.latency_ms ?? undefined,
      retry_count: row.retry_count ?? undefined,
      checksum_config: row.checksum_config,
      drift_detected: row.drift_detected !== null ? row.drift_detected === 1 : undefined,
      drift_reason: row.drift_reason ?? undefined,
      response_model: row.response_model ?? undefined,
      system_fingerprint: row.system_fingerprint ?? undefined,
      cache_hit: row.cache_hit !== null ? row.cache_hit === 1 : undefined,
    }));
  }

  async function loadLastRows(limit: number): Promise<readonly TelemetryEvent[]> {
    const lim = Math.max(1, Math.min(1000, Math.floor(limit || 1)));
    const rows = database
      .prepare(
        "SELECT ts, tenant, route, service_label, allowed, block_reason, redaction_applied, drift_strict, budget_before_usd, est_cost_usd, final_cost_usd, tokens_in, tokens_out, latency_ms, retry_count, checksum_config, drift_detected, drift_reason, response_model, system_fingerprint, cache_hit FROM telemetry_events ORDER BY ts DESC LIMIT ?"
      )
      .all(lim) as Array<{
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
      retry_count: number | null;
      checksum_config: string;
      drift_detected: number | null;
      drift_reason: string | null;
      response_model: string | null;
      system_fingerprint: string | null;
      cache_hit: number | null;
    }>;

    return rows.map((row) => ({
      ts: row.ts,
      tenant: row.tenant,
      route: row.route,
      service_label: row.service_label,
      allowed: row.allowed === 1,
      block_reason: row.block_reason ?? undefined,
      redaction_applied: row.redaction_applied === 1,
      drift_strict: row.drift_strict === 1,
      budget_before_usd: row.budget_before_usd,
      est_cost_usd: row.est_cost_usd,
      final_cost_usd: row.final_cost_usd ?? undefined,
      tokens_in: row.tokens_in ?? undefined,
      tokens_out: row.tokens_out ?? undefined,
      latency_ms: row.latency_ms ?? undefined,
      retry_count: row.retry_count ?? undefined,
      checksum_config: row.checksum_config,
      drift_detected: row.drift_detected !== null ? row.drift_detected === 1 : undefined,
      drift_reason: row.drift_reason ?? undefined,
      response_model: row.response_model ?? undefined,
      system_fingerprint: row.system_fingerprint ?? undefined,
      cache_hit: row.cache_hit !== null ? row.cache_hit === 1 : undefined,
    }));
  }

  return { appendBatch, loadTodayRows, loadLastRows };
}

