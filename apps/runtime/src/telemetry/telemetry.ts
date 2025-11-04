export interface TelemetryEvent {
  readonly ts: number;
  readonly tenant: string;
  readonly route: string;
  readonly service_label: string;
  readonly allowed: boolean;
  readonly block_reason?: string;
  readonly redaction_applied: boolean;
  readonly drift_strict: boolean;
  readonly budget_before_usd: number;
  readonly est_cost_usd: number;
  readonly final_cost_usd?: number;
  readonly tokens_in?: number;
  readonly tokens_out?: number;
  readonly latency_ms?: number;
  readonly retry_count?: number;
  readonly checksum_config: string;
  readonly drift_detected?: boolean;
  readonly drift_reason?: string;
  readonly response_model?: string;
  readonly system_fingerprint?: string;
  readonly cache_hit?: boolean;
}

export class TelemetryBuffer {
  private readonly buffer: TelemetryEvent[] = [];

  push(event: TelemetryEvent): void {
    this.buffer.push(event);
  }

  drain(): readonly TelemetryEvent[] {
    const copy = [...this.buffer];
    this.buffer.length = 0;
    return copy;
  }
}

const globalBuffer = new TelemetryBuffer();

export function recordCall(event: TelemetryEvent): void {
  globalBuffer.push(event);
}

export function drainBuffer(): readonly TelemetryEvent[] {
  return globalBuffer.drain();
}

