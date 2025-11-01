export function getSecretFromEnv(ref: string): string | undefined {
  const key = ref.replace(/_ref$/u, "").toUpperCase();
  return process.env[key];
}

