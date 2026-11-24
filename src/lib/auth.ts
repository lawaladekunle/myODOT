import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, nowISO, tx, UserError } from "./db";
import { DEFAULT_TAGS } from "./model";

export type User = { id: number; email: string; name: string; isAdmin: boolean };
/** Who is making a change. Agents act on behalf of the user who owns their API token. */
export type Actor = { userId: number; kind: "user" | "agent"; name: string };

const COOKIE = "odot_session";
const SESSION_DAYS = 30;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(pw: string, stored: string) {
  const [, salt, key] = stored.split("$");
  const expected = Buffer.from(key ?? "", "base64");
  const actual = await scryptAsync(pw, Buffer.from(salt ?? "", "base64"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validatePassword(pw: string) {
  if (pw.length < 10) throw new UserError("Use at least 10 characters for the password.");
}

// ---- users ----

export async function createUser(input: { name: string; email: string; password: string; isAdmin: boolean }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new UserError("Enter a name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new UserError("Enter a valid email address.");
  validatePassword(input.password);
  const hash = await hashPassword(input.password);
  return tx(() => {
    if (db().prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new UserError("That email already has an account.");
    const { lastInsertRowid } = db()
      .prepare("INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, ?)")
      .run(email, name, hash, input.isAdmin ? 1 : 0);
    const addTag = db().prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)");
    for (const [tag, color] of DEFAULT_TAGS) addTag.run(lastInsertRowid, tag, color);
    return Number(lastInsertRowid);
  });
}

/** Creates the first admin from ODOT_ADMIN_EMAIL / ODOT_ADMIN_PASSWORD when the database has no users. */
export async function ensureAdmin() {
  const { n } = db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n > 0) return true;
  const email = process.env.ODOT_ADMIN_EMAIL;
  const password = process.env.ODOT_ADMIN_PASSWORD;
  if (!email || !password) return false;
  await createUser({ name: process.env.ODOT_ADMIN_NAME || email.split("@")[0], email, password, isAdmin: true });
  return true;
}

export function listUsers(): (User & { createdAt: string })[] {
  return (db().prepare("SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at").all() as Record<string, never>[]).map(
    (r) => ({ id: r.id, email: r.email, name: r.name, isAdmin: r.is_admin === 1, createdAt: r.created_at }),
  );
}

export async function setPassword(userId: number, password: string) {
  validatePassword(password);
  const hash = await hashPassword(password);
  tx(() => {
    db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
    db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  });
}

export async function checkPassword(userId: number, password: string) {
  const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined;
  return !!row && (await verifyPassword(password, row.password_hash));
}

export function deleteUser(userId: number) {
  tx(() => {
    const { n } = db().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND id != ?").get(userId) as { n: number };
    if (n === 0) throw new UserError("ODOT needs at least one admin. Make someone else admin first.");
    db().prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
}

export function setAdmin(userId: number, isAdmin: boolean) {
  tx(() => {
    if (!isAdmin) {
      const { n } = db().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND id != ?").get(userId) as { n: number };
      if (n === 0) throw new UserError("ODOT needs at least one admin.");
    }
    db().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(isAdmin ? 1 : 0, userId);
  });
}

export function renameUser(userId: number, name: string) {
  if (!name.trim()) throw new UserError("Enter a name.");
  db().prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), userId);
}

// ---- sessions ----

// shortcut: in-memory, so limits reset on restart and don't span replicas. Fine for one container.
const attempts = new Map<string, { count: number; resetAt: number }>();
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function login(email: string, password: string) {
  const key = `${await clientIp()}|${email.toLowerCase()}`;
  const now = Date.now();
  const a = attempts.get(key);
  if (a && a.resetAt > now && a.count >= 10) throw new UserError("Too many attempts. Wait 15 minutes and try again.");

  const row = db().prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email.trim()) as
    | { id: number; password_hash: string }
    | undefined;
  // Hash even for unknown emails so response time doesn't reveal which emails exist.
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    attempts.set(key, a && a.resetAt > now ? { ...a, count: a.count + 1 } : { count: 1, resetAt: now + 15 * 60_000 });
    throw new UserError("Email or password is wrong.");
  }
  attempts.delete(key);

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now + SESSION_DAYS * 864e5);
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowISO());
  db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), row.id, expires.toISOString());
  const h = await headers();
  const secure = h.get("x-forwarded-proto") === "https" || process.env.ODOT_SECURE_COOKIE === "1";
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const r = db()
    .prepare(
      "SELECT u.id, u.email, u.name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    )
    .get(sha256(token), nowISO()) as { id: number; email: string; name: string; is_admin: number } | undefined;
  return r ? { id: r.id, email: r.email, name: r.name, isAdmin: r.is_admin === 1 } : null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new UserError("Only admins can do that.");
  return user;
}

export const userActor = (u: User): Actor => ({ userId: u.id, kind: "user", name: u.name });

// ---- API tokens for agents ----

export function createApiToken(userId: number, name: string) {
  if (!name.trim()) throw new UserError("Give the token a name, for example the agent's name.");
  const token = `odot_${randomBytes(32).toString("base64url")}`;
  db().prepare("INSERT INTO api_tokens (user_id, name, token_hash) VALUES (?, ?, ?)").run(userId, name.trim(), sha256(token));
  return token;
}

export function listApiTokens(userId: number) {
  return (db().prepare("SELECT id, name, created_at AS createdAt, last_used_at AS lastUsedAt FROM api_tokens WHERE user_id = ? ORDER BY id").all(userId) as {
    id: number;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
  }[]).map((t) => ({ ...t }));
}

export function revokeApiToken(userId: number, id: number) {
  db().prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").run(id, userId);
}

export function actorFromBearer(req: Request): Actor | null {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const row = db().prepare("SELECT id, user_id, name FROM api_tokens WHERE token_hash = ?").get(sha256(m[1])) as
    | { id: number; user_id: number; name: string }
    | undefined;
  if (!row) return null;
  db().prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(nowISO(), row.id);
  return { userId: row.user_id, kind: "agent", name: row.name };
}
