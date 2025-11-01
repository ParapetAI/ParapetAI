import { getRuntimeContext } from "@parapetai/parapet/runtime/core/state";

export interface CallerContext {
  readonly serviceLabel: string;
  readonly tenant: string;
  readonly allowedRoutes: readonly string[];
}

export function getCallerContext(token: string): CallerContext | null {
  const ctx = getRuntimeContext();
  const found = ctx.serviceKeyToContext.get(token);
  return found ? { ...found } : null;
}
