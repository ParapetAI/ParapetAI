export function getSecretFromEnv(ref: string): string | undefined {
  const trimmed = ref.trim();
  const envPrefix = "ENV:";
  if (trimmed.toUpperCase().startsWith(envPrefix)) {
    const varName = trimmed.slice(envPrefix.length).trim();
    return process.env[varName];
  }
  const base = trimmed
    .replace(/_ref$/u, "")
    .replace(/[^A-Za-z0-9_]/gu, "_")
    .toUpperCase();
  const direct = process.env[base];
  if (direct && direct.length > 0) return direct;
  const prefixed = process.env[`PARAPET_${base}`];
  if (prefixed && prefixed.length > 0) return prefixed;
  return undefined;
}

