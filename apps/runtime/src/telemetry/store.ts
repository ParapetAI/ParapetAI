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
  const db = new Database(dbPath, { fileMustExist: false, readonly: false });

  const insertStmt = db.prepare(
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
        retry_count: e.retry_count ?? null,
        checksum_config: e.checksum_config,
        drift_detected: e.drift_detected !== undefined ? (e.drift_detected ? 1 : 0) : null,
        drift_reason: e.drift_reason ?? null,
        response_model: e.response_model ?? null,
        system_fingerprint: e.system_fingerprint ?? null,
        cache_hit: e.cache_hit !== undefined ? (e.cache_hit ? 1 : 0) : null,
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
      retry_count: r.retry_count ?? undefined,
      checksum_config: r.checksum_config,
      drift_detected: r.drift_detected !== null ? r.drift_detected === 1 : undefined,
      drift_reason: r.drift_reason ?? undefined,
      response_model: r.response_model ?? undefined,
      system_fingerprint: r.system_fingerprint ?? undefined,
      cache_hit: r.cache_hit !== null ? r.cache_hit === 1 : undefined,
    }));
  }

  async function loadLastRows(limit: number): Promise<readonly TelemetryEvent[]> {
    const lim = Math.max(1, Math.min(1000, Math.floor(limit || 1)));
    const rows = db
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
      retry_count: r.retry_count ?? undefined,
      checksum_config: r.checksum_config,
      drift_detected: r.drift_detected !== null ? r.drift_detected === 1 : undefined,
      drift_reason: r.drift_reason ?? undefined,
      response_model: r.response_model ?? undefined,
      system_fingerprint: r.system_fingerprint ?? undefined,
      cache_hit: r.cache_hit !== null ? r.cache_hit === 1 : undefined,
    }));
  }

  return { appendBatch, loadTodayRows, loadLastRows };
}

