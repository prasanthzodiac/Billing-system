import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { cookies, headers } from "next/headers";

import { db } from "@/lib/server/db";
import { getEnv } from "@/lib/server/env";

const SESSION_COOKIE = "ledgerly_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordHash(password: string) {
  return hash(password, 12);
}

export function passwordMatches(password: string, storedHash: string) {
  return compare(password, storedHash);
}

export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } }
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return {
    sessionId: session.id,
    user: session.user,
    permissions: new Set(session.user.roles.flatMap((userRole) => userRole.role.permissions.map((item) => item.permission.key)))
  };
}

export async function requireSession() {
  const session = await readSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requirePermission(permission: string) {
  const session = await requireSession();
  if (!session.permissions.has(permission)) throw new Error("FORBIDDEN");
  return session;
}

export async function requireAnyPermission(...permissions: string[]) {
  const session = await requireSession();
  if (!permissions.some((permission) => session.permissions.has(permission))) throw new Error("FORBIDDEN");
  return session;
}

export async function createSession(userId: string) {
  const env = getEnv();
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const requestHeaders = await headers();
  await db.session.create({ data: { userId, tokenHash: tokenHash(rawToken), expiresAt, userAgent: requestHeaders.get("user-agent"), ipAddress: env.TRUST_PROXY === "true" ? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() : null } });
  (await cookies()).set(SESSION_COOKIE, rawToken, { httpOnly: true, sameSite: "lax", secure: env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function consumeLoginFailure(key: string) {
  const now = new Date();
  const attempt = await db.loginAttempt.upsert({ where: { key }, create: { key, failures: 1 }, update: { failures: { increment: 1 } } });
  if (attempt.lockedUntil && attempt.lockedUntil > now) throw new Error("RATE_LIMITED");
  if (attempt.failures >= MAX_LOGIN_FAILURES) {
    await db.loginAttempt.update({ where: { id: attempt.id }, data: { lockedUntil: new Date(now.getTime() + LOCKOUT_MS) } });
    throw new Error("RATE_LIMITED");
  }
}

export async function clearLoginFailures(key: string) {
  await db.loginAttempt.deleteMany({ where: { key } });
}
