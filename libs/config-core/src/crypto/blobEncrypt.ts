import crypto from "node:crypto";
import type { HydratedConfig } from "../hydration/hydratedTypes";

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/gu, "")
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_");
}

function base64urlDecode(input: string): Buffer {
  const b64 = input.replace(/-/gu, "+").replace(/_/gu, "/");
  const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
  return Buffer.from(b64 + "=".repeat(pad), "base64");
}

export function encryptHydratedConfigToBlob(config: HydratedConfig, masterKeyB64Url: string): string {
  const key: Buffer = base64urlDecode(masterKeyB64Url);
  if (key.length !== 32) throw new Error("PARAPET_MASTER_KEY must decode to 32 bytes");

  const iv: Buffer = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  const aad = Buffer.from("parapet:v1", "utf8");
  cipher.setAAD(aad);

  const plaintext = Buffer.from(JSON.stringify(config), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    v: 1,
    alg: "AES-256-GCM",
    iv: base64urlEncode(iv),
    ct: base64urlEncode(encrypted),
    tag: base64urlEncode(tag),
  } as const;

  const json = Buffer.from(JSON.stringify(payload), "utf8");
  return base64urlEncode(json);
}

export function validateAndNormalizeMasterKey(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const buf = base64urlDecode(input);
    if (buf.length !== 32) return undefined;
    return base64urlEncode(buf); // normalize padding/charset
  } catch {
    return undefined;
  }
}

export function generateMasterKey(): string {
  const key = crypto.randomBytes(32);
  return base64urlEncode(key);
}


