export interface BudgetCounter {
  readonly spentCents: number;
}

export function createBudgetCounter(): BudgetCounter {
  return { spentCents: 0 };
}
