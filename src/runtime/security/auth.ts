export interface CallerContext {
  readonly subject: string;
  readonly roles: readonly string[];
}

export function authenticateToken(_token: string): CallerContext | null {
  return { subject: "anon", roles: [] } as const;
}
