export interface RuntimeRequest {
  readonly routeId: string;
  readonly userId?: string;
  readonly input: unknown;
}

export interface RuntimeResponse {
  readonly output: unknown;
}

// API responses

export interface HealthResponse {
  readonly ok: true;
}

export interface APIResponse<T> {
  statusCode: number;
  data: T;
}