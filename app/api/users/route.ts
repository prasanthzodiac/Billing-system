import { NextResponse } from "next/server";

import { passwordHash, requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";
import { userCreateSchema } from "@/lib/server/schemas";

export async function GET() {
  try {
    const session = await requirePermission("admin.write");
    const [users, roles, permissions] = await Promise.all([
      db.user.findMany({ where: { companyId: session.user.companyId }, orderBy: [{ status: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, roles: { select: { role: { select: { id: true, name: true } } } } } }),
      db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, permissions: { select: { permission: { select: { id: true, key: true, description: true } } } } } }),
      db.permission.findMany({ orderBy: { key: "asc" }, select: { id: true, key: true, description: true } })
    ]);
    return NextResponse.json({ data: users.map((user) => ({ ...user, roles: user.roles.map((item) => ({ id: item.role.id, name: item.role.name })) })), roles: roles.map((role) => ({ ...role, permissions: role.permissions.map((item) => item.permission) })), permissions });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const input = userCreateSchema.parse(await readJson(request));
    const roles = await db.role.findMany({ where: { id: { in: input.roleIds } }, select: { id: true, name: true } });
    if (roles.length !== input.roleIds.length) throw new Error("BAD_REQUEST:Select valid roles for this user.");
    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new Error("CONFLICT:A user with this email already exists.");
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { companyId: session.user.companyId, name: input.name, email: input.email, passwordHash: await passwordHash(input.password), roles: { create: roles.map((role) => ({ roleId: role.id })) } }, select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, roles: { select: { role: { select: { id: true, name: true } } } } } });
      await tx.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "USER_CREATED", entityType: "User", entityId: created.id, newValue: { name: created.name, email: created.email, roles: roles.map((role) => role.name) } } });
      await tx.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "SUCCESS", title: "User added", message: `${created.name} can now access the billing workspace.`, entityType: "User", entityId: created.id, href: "/?view=Manage%20users" } });
      return created;
    });
    return NextResponse.json({ data: { ...user, roles: user.roles.map((item) => ({ id: item.role.id, name: item.role.name })) } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
