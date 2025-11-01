export enum LogLevel {
  info = "info",
  warn = "warn",
  error = "error",
}

export function log(level: LogLevel, message: string): void {
  // prettier-ignore
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
}

