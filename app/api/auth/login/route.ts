import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { clearLoginFailures, consumeLoginFailure, createSession, passwordMatches } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError, requestClientKey } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";

const loginSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(12).max(128) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await readJson(request));
    const key = `${requestClientKey(request)}:${input.email}`;
    await consumeLoginFailure(key);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const matches = user ? await passwordMatches(input.password, user.passwordHash) : false;
    if (!user || !matches || user.status !== "ACTIVE") {
      if (user) await db.auditLog.create({ data: { companyId: user.companyId, userId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id } }).catch(() => undefined);
      throw new Error("BAD_REQUEST:Invalid email or password.");
    }
    await clearLoginFailures(key);
    await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    return jsonError(error);
  }
}
