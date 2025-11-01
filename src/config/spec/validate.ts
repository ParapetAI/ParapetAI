import type { ParapetSpec } from "./types";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export function validateRequired(spec: ParapetSpec): ValidationResult {
  if (!spec) {
    return { ok: false, issues: [{ path: "", message: "spec is required" }] };
  }
  return { ok: true, issues: [] } as const;
}
