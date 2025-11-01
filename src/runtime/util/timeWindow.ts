export interface TimeWindow {
  readonly startMs: number;
  readonly endMs: number;
}

export function currentWindow(_minutes: number): TimeWindow {
  const now = Date.now();
  return { startMs: now, endMs: now };
}

