import type { CallerContext } from "../security/auth";

export interface PolicyDecision {
  readonly allow: boolean;
  readonly reason?: string;
}

export function evaluatePolicy(_ctx: CallerContext): PolicyDecision {
  return { allow: true } as const;
}
