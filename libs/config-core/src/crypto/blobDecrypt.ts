import crypto from "node:crypto";
import type { HydratedConfig } from "../hydration/hydratedTypes";

function base64urlDecode(input: string): Buffer {
  const b64 = input.replace(/-/gu, "+").replace(/_/gu, "/");
  const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
  return Buffer.from(b64 + "=".repeat(pad), "base64");
}

export function decryptBlobToHydratedConfig(blobB64Url: string, masterKeyB64Url: string): HydratedConfig {
  const key = base64urlDecode(masterKeyB64Url);
  if (key.length !== 32) throw new Error("PARAPET_MASTER_KEY must decode to 32 bytes");
  const jsonBuf = base64urlDecode(blobB64Url);
  let payload: { v: number; alg: string; iv: string; ct: string; tag: string };
  try {
    payload = JSON.parse(jsonBuf.toString("utf8"));
  } catch {
    throw new Error("Invalid PARAPET_BOOTSTRAP_STATE format");
  }
  if (payload.v !== 1 || payload.alg !== "AES-256-GCM") {
    throw new Error("Unsupported bootstrap blob version or algorithm");
  }
  const iv = base64urlDecode(payload.iv);
  const ct = base64urlDecode(payload.ct);
  const tag = base64urlDecode(payload.tag);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  const aad = Buffer.from("parapet:v1", "utf8");
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
  const obj = JSON.parse(decrypted.toString("utf8")) as HydratedConfig;
  return obj;
}


