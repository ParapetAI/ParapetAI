export interface BudgetCounter {
  readonly spentCents: number;
}

export function createBudgetCounter(): BudgetCounter {
  return { spentCents: 0 };
}

import type { TelemetryEvent } from "@parapetai/parapet/runtime/telemetry/telemetry";

let todayCounter: BudgetCounter = createBudgetCounter();

export function getTodayCounter(): BudgetCounter {
  return todayCounter;
}

export function rebuildFromRows(rows: readonly TelemetryEvent[]): void {
  let sumUsd = 0;
  for (const r of rows) {
    const usd = typeof r.final_cost_usd === "number" ? r.final_cost_usd : r.est_cost_usd;
    sumUsd += usd;
  }
  const cents = Math.round(sumUsd * 100);
  todayCounter = { spentCents: cents };
}