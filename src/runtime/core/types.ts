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

export interface InvokeResponse {
  readonly output: string;
}

export interface APIResponse<T = undefined> {
  statusCode: number;
  error?: string;
  data?: T;
}