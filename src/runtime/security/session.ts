import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { HydratedUser } from "@parapetai/parapet/config/hydration/hydratedTypes";

interface HashedUserRecord {
  readonly username: string;
  readonly saltHex: string;
  readonly hashHex: string;
}

interface SessionRecord {
  readonly username: string;
  readonly expiresAt: number;
}

const usersByName: Map<string, HashedUserRecord> = new Map();
const sessions: Map<string, SessionRecord> = new Map();

const SESSION_COOKIE = "parapet_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function initAdminUsers(hydratedUsers: readonly HydratedUser[]): void {
  usersByName.clear();
  for (const u of hydratedUsers) {
    const salt = randomBytes(16);
    // scrypt with reasonable parameters; keylen 32
    const hash = scryptSync(Buffer.from(u.password_plaintext, "utf8"), salt, 32);
    usersByName.set(u.username, {
      username: u.username,
      saltHex: salt.toString("hex"),
      hashHex: hash.toString("hex"),
    });
  }
}

export function verifyPassword(username: string, password: string): boolean {
  const rec = usersByName.get(username);
  if (!rec) return false;
  const salt = Buffer.from(rec.saltHex, "hex");
  const expected = Buffer.from(rec.hashHex, "hex");
  const actual = scryptSync(Buffer.from(password, "utf8"), salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function createSession(username: string): string {
  const id = randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(id, { username, expiresAt: now + SESSION_TTL_MS });
  return id;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionFromRequest(request: FastifyRequest): SessionRecord | null {
  const cookie = request.headers["cookie"];
  if (typeof cookie !== "string") return null;
  const name = `${SESSION_COOKIE}=`;
  const idx = cookie.indexOf(name);
  if (idx === -1) return null;
  const val = cookie.slice(idx + name.length).split(";")[0].trim();
  if (!val) return null;
  const rec = sessions.get(val);
  if (!rec) return null;
  if (rec.expiresAt <= Date.now()) {
    sessions.delete(val);
    return null;
  }
  return rec;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  const cookie = `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}`;
  // In production behind TLS, uncomment Secure. Here we avoid breaking local dev without HTTPS.
  // const cookie = `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  reply.header("Set-Cookie", cookie);
}

export function clearSessionCookie(reply: FastifyReply): void {
  const cookie = `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
  reply.header("Set-Cookie", cookie);
}


