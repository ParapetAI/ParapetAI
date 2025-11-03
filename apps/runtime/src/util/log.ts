export enum LogLevel {
  info = "info",
  warn = "warn",
  error = "error",
}

export function log(level: LogLevel, message: string): void {
  setImmediate(() => {
    // prettier-ignore
    console.log(`${new Date().toISOString()} [${level}] ${message}`);
  });
}

