export const SUPPORTED_PROVIDERS = ["openai", "local"] as const;
export type ProviderName = typeof SUPPORTED_PROVIDERS[number];

export const REDACTION_RULES = ["email", "api_key", "ip", "phone"] as const;
export type RedactionRuleName = typeof REDACTION_RULES[number];


