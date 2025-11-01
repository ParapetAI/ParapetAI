import type { TelemetryEvent } from "./telemetry";

export async function startTelemetryWriter(_read: () => readonly TelemetryEvent[]): Promise<void> {
  // Placeholder background loop would flush events
}

