export interface TelemetryEvent {
  readonly type: string;
  readonly ts: number;
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

