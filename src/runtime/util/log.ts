export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string): void {
  // prettier-ignore
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
}

