export interface RuntimeRequest {
  readonly routeId: string;
  readonly userId?: string;
  readonly input: unknown;
}

export interface RuntimeResponse {
  readonly output: unknown;
}
