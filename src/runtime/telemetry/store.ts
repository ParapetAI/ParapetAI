import type { TelemetryEvent } from "./telemetry";

export interface TelemetryStore {
  append(events: readonly TelemetryEvent[]): Promise<void>;
  readAll(): Promise<readonly TelemetryEvent[]>;
}

