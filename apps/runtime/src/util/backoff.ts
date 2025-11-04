export function computeDelayMs(attempt: number, baseMs: number, jitter: boolean): number {
  const exp = Math.max(0, attempt - 1);
  const delay = baseMs * Math.pow(2, exp);
  if (!jitter) return delay;
  const max = Math.max(baseMs, delay);
  return Math.floor(Math.random() * max);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.floor(ms))));
}


