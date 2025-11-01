export interface RuntimeState {
  readonly startedAt: number;
}

export function createRuntimeState(): RuntimeState {
  return { startedAt: Date.now() };
}
