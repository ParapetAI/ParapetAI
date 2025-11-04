import { REDACTION_RULES, type RedactionRuleName } from "@parapetai/config-core";

type RedactionResult =
  | { output: string; applied: boolean }
  | { blocked: true; reason: "redaction_blocked" };

const regexByRule: Record<RedactionRuleName, RegExp> = {
  email: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  api_key: /(?:api|key|secret)[_\-]?(?:id|key)?[:=\s]*[A-Za-z0-9_\-]{16,}/gi,
  ip: /\b(?:(?:2(5[0-5]|[0-4]\d))|1?\d?\d)(?:\.(?:(?:2(5[0-5]|[0-4]\d))|1?\d?\d)){3}\b/g,
  phone:
    /(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]*\d{3}[-.\s]*\d{4}(?!\d)/g,
};

interface CompiledPattern {
  readonly regex: RegExp;
  readonly tag: RedactionRuleName | "custom";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryParseSlashRegex(pattern: string): RegExp | null {
  if (!pattern.startsWith("/")) 
    return null;

  const last = pattern.lastIndexOf("/");
  if (last <= 0) 
    return null;

  const body = pattern.slice(1, last);
  const flags = pattern.slice(last + 1) || "gi";

  try {
    return new RegExp(body, flags);
  } catch {
    return null;
  }
}

function buildCompiledPatterns(patterns: readonly string[]): CompiledPattern[] {
  const out: CompiledPattern[] = [];
  const enabledBuiltins = new Set<RedactionRuleName>();
  for (const p of patterns) {
    if ((REDACTION_RULES as readonly string[]).includes(p)) {
      enabledBuiltins.add(p as RedactionRuleName);
      continue;
    }

    let rx: RegExp | null = null;
    if (p.startsWith("re:")) {
      const body = p.slice(3);
      try {
        rx = new RegExp(body, "gi");
      } catch {
        rx = null;
      }
    } else {
      rx = tryParseSlashRegex(p);
      if (!rx) {
        // treat as literal substring
        rx = new RegExp(escapeRegExp(p), "gi");
      }
    }

    if (rx) 
      out.push({ regex: rx, tag: "custom" });
  }

  for (const name of enabledBuiltins) 
    out.push({ regex: regexByRule[name], tag: name });

  return out;
}

export function redact(
  input: string,
  mode: "warn" | "block" | "off",
  patterns: readonly string[]
): RedactionResult {
  if (mode === "off") 
    return { output: input, applied: false } as const;

  const compiled = buildCompiledPatterns(patterns);
  let found = false;
  for (const r of compiled) {
    r.regex.lastIndex = 0;
    if (r.regex.test(input)) {
      found = true;
      break;
    }
  }

  if (!found) 
    return { output: input, applied: false } as const;

  if (mode === "block") 
    return { blocked: true, reason: "redaction_blocked" } as const;

  // warn → scrub secrets
  let output = input;
  for (const r of compiled) {
    const replacement =
      r.tag === "email"
        ? "[REDACTED_EMAIL]"
        : r.tag === "api_key"
        ? "[REDACTED_API_KEY]"
        : r.tag === "ip"
        ? "[REDACTED_IP]"
        : r.tag === "phone"
        ? "[REDACTED_PHONE]"
        : "[REDACTED]";
    output = output.replace(r.regex, replacement);
  }
  
  return { output, applied: true } as const;
}
