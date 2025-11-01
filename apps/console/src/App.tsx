import React, { useEffect, useMemo, useState } from "react";

interface UsageRow {
  readonly tenant: string;
  readonly route: string;
  readonly spentTodayUsd: number;
  readonly routeDailyCapUsd: number;
  readonly tenantDailyCapUsd: number;
  readonly remainingRouteBudgetUsd: number;
  readonly remainingTenantBudgetUsd: number;
}

interface BlockedSummary {
  readonly budget_exceeded?: number;
  readonly not_allowed?: number;
  readonly drift_violation?: number;
  readonly redaction_blocked?: number;
  readonly total?: number;
}

interface ChecksumResponse {
  readonly checksum: string;
}

interface TelemetryEventRow {
  readonly ts: number;
  readonly tenant: string;
  readonly route: string;
  readonly service_label: string;
  readonly allowed: boolean;
  readonly block_reason?: string;
  readonly est_cost_usd: number;
  readonly final_cost_usd?: number;
  readonly latency_ms?: number;
}

function httpRedirectToLogin(): void {
  // Avoid leaking any response content; just bounce to login
  (window as any).location = "/console/login";
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (res.status === 401) {
    httpRedirectToLogin();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(`request_failed:${res.status}`);
  }
  return (await res.json()) as T;
}

function shortChecksum(full: string | undefined): string {
  if (!full) return "";
  return full.slice(0, 8);
}

function Header(props: { checksum?: string }): JSX.Element {
  const short = useMemo(() => shortChecksum(props.checksum), [props.checksum]);
  const onLogout = async (): Promise<void> => {
    try {
      const res = await fetch("/console/logout", { method: "POST", credentials: "include" });
      if (res.status === 401) {
        httpRedirectToLogin();
        return;
      }
      // Always redirect to login after logout
      (window as any).location = "/console/login";
    } catch {
      (window as any).location = "/console/login";
    }
  };

  return (
    <div className="w-full sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80 bg-slate-900/95 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between py-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-300">
            Parapet Console
          </div>
          {short && (
            <span className="text-xs bg-slate-800/80 text-slate-300 px-2 py-1 rounded border border-slate-700">
              {short}
            </span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded px-3 py-1 transition-colors"
        >
          Log out
        </button>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
    </div>
  );
}

function Card(props: { title: string; subtitle?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm text-slate-200 font-medium">{props.title}</div>
        {props.subtitle ? <div className="text-xs text-slate-400 mt-0.5">{props.subtitle}</div> : null}
      </div>
      {props.children}
    </div>
  );
}

function SpendCard(props: { rows: readonly UsageRow[] }): JSX.Element {
  if (!props.rows.length) {
    return (
      <Card title="Spend / Budget">
        <div className="text-slate-400 text-sm">No usage yet.</div>
      </Card>
    );
  }
  return (
    <Card title="Spend / Budget" subtitle="Per tenant and route for today">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-slate-300">
              <th className="py-2 pr-4 font-medium">Tenant</th>
              <th className="py-2 pr-4 font-medium">Route</th>
              <th className="py-2 pr-4 font-medium">Spent Today</th>
              <th className="py-2 pr-4 font-medium">Route Daily Cap</th>
              <th className="py-2 pr-4 font-medium">Tenant Daily Cap</th>
              <th className="py-2 pr-4 font-medium">Remaining Route</th>
              <th className="py-2 pr-0 font-medium">Remaining Tenant</th>
            </tr>
          </thead>
          <tbody className="text-slate-200 divide-y divide-slate-800">
            {props.rows.map((r, idx) => (
              <tr key={`${r.tenant}:${r.route}:${idx}`}>
                <td className="py-2 pr-4 whitespace-nowrap">{r.tenant}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{r.route}</td>
                <td className="py-2 pr-4 whitespace-nowrap">${r.spentTodayUsd.toFixed(4)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">${r.routeDailyCapUsd.toFixed(2)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">${r.tenantDailyCapUsd.toFixed(2)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">${r.remainingRouteBudgetUsd.toFixed(2)}</td>
                <td className="py-2 pr-0 whitespace-nowrap">${r.remainingTenantBudgetUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BlockedCard(props: { summary: BlockedSummary | undefined }): JSX.Element {
  const s = props.summary ?? {};
  const total = s.total ?? 0;
  return (
    <Card title="Blocked Summary" subtitle="Counts for today">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-200 text-sm">
        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 shadow-sm">
          <div className="text-slate-400 text-xs">budget_exceeded</div>
          <div className="text-lg font-semibold">{s.budget_exceeded ?? 0}</div>
        </div>
        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 shadow-sm">
          <div className="text-slate-400 text-xs">not_allowed</div>
          <div className="text-lg font-semibold">{s.not_allowed ?? 0}</div>
        </div>
        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 shadow-sm">
          <div className="text-slate-400 text-xs">drift_violation</div>
          <div className="text-lg font-semibold">{s.drift_violation ?? 0}</div>
        </div>
        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 shadow-sm">
          <div className="text-slate-400 text-xs">redaction_blocked</div>
          <div className="text-lg font-semibold">{s.redaction_blocked ?? 0}</div>
        </div>
      </div>
      <div className="text-slate-300 text-xs mt-3">Total blocked calls today: {total}</div>
    </Card>
  );
}

function ChecksumCard(props: { checksum?: string }): JSX.Element {
  return (
    <Card title="Checksum" subtitle="Derived from the active config state">
      <div className="font-mono text-slate-200 text-sm break-all">{props.checksum ?? ""}</div>
      <div className="text-slate-400 text-xs mt-2">
        If checksums differ between clusters, you're not running the same config.
      </div>
    </Card>
  );
}

function TelemetryCard(props: {
  rows: readonly TelemetryEventRow[];
  limit: number;
  setLimit: (n: number) => void;
}): JSX.Element {
  const limits = [25, 50, 100, 200, 500, 1000];
  return (
    <Card title="Recent Telemetry" subtitle="Newest first">
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-300 text-xs">View last N events</div>
        <select
          value={props.limit}
          onChange={(e) => props.setLimit(Number(e.target.value))}
          className="bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded px-2 py-1"
        >
          {limits.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {props.rows.length === 0 ? (
        <div className="text-slate-400 text-sm">No telemetry yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm table-auto">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Tenant</th>
                <th className="py-2 pr-4 font-medium">Route</th>
                <th className="py-2 pr-4 font-medium">Service</th>
                <th className="py-2 pr-4 font-medium">Outcome</th>
                <th className="py-2 pr-4 font-medium">Cost (USD)</th>
                <th className="py-2 pr-0 font-medium">Latency (ms)</th>
              </tr>
            </thead>
            <tbody className="text-slate-200 divide-y divide-slate-800">
              {props.rows.map((e, idx) => {
                const outcome = e.allowed ? "allowed" : e.block_reason ?? "blocked";
                const cost = (e.final_cost_usd ?? e.est_cost_usd).toFixed(4);
                const when = new Date(e.ts).toLocaleString();
                return (
                  <tr key={`${e.ts}:${idx}`}>
                    <td className="py-2 pr-4 whitespace-nowrap">{when}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{e.tenant}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{e.route}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{e.service_label}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{outcome}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">${cost}</td>
                    <td className="py-2 pr-0 whitespace-nowrap">{e.latency_ms ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function App(): JSX.Element {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [blocked, setBlocked] = useState<BlockedSummary | undefined>(undefined);
  const [checksum, setChecksum] = useState<string | undefined>(undefined);
  const [telemetry, setTelemetry] = useState<TelemetryEventRow[]>([]);
  const [telemetryLimit, setTelemetryLimit] = useState<number>(100);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, b, c] = await Promise.all([
          fetchJson<UsageRow[]>("/console/data/usage"),
          fetchJson<BlockedSummary>("/console/data/blocked"),
          fetchJson<ChecksumResponse>("/console/data/checksum"),
        ]);
        if (cancelled) return;
        setUsage(u);
        setBlocked(b);
        setChecksum(c.checksum);
      } catch (e: any) {
        if (cancelled) return;
        const msg = typeof e?.message === "string" ? e.message : "load_failed";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchJson<TelemetryEventRow[]>(`/console/data/telemetry?limit=${telemetryLimit}`);
        if (cancelled) return;
        setTelemetry(rows);
      } catch (e: any) {
        if (cancelled) return;
        // leave global error alone; only affect telemetry area silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [telemetryLimit]);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <Header checksum={checksum} />
      <div className="max-w-6xl mx-auto p-4 grid gap-4">
        {error && (
          <div className="bg-rose-950 border border-rose-800 text-rose-200 text-sm rounded p-3">
            Failed to load data: {error}
          </div>
        )}
        {loading ? (
          <>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 animate-pulse h-48" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-24 animate-pulse" />
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-24 animate-pulse" />
            </div>
          </>
        ) : (
          <>
            <SpendCard rows={usage} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BlockedCard summary={blocked} />
              <ChecksumCard checksum={checksum} />
            </div>
            <TelemetryCard rows={telemetry} limit={telemetryLimit} setLimit={setTelemetryLimit} />
          </>
        )}
      </div>
    </div>
  );
}


