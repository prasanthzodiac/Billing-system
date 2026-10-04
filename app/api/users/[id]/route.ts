import { NextRequest, NextResponse } from "next/server";

import { passwordHash, requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";
import { userUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const { id } = await context.params;
    const input = userUpdateSchema.parse(await readJson(request));
    if (id === session.user.id && input.status === "INACTIVE") throw new Error("BAD_REQUEST:You cannot deactivate your own administrator account.");
    const [existing, roles] = await Promise.all([
      db.user.findFirst({ where: { id, companyId: session.user.companyId }, select: { id: true, name: true, email: true, status: true, roles: { select: { role: { select: { name: true } } } } } }),
      db.role.findMany({ where: { id: { in: input.roleIds } }, select: { id: true, name: true } })
    ]);
    if (!existing) throw new Error("BAD_REQUEST:User was not found.");
    if (roles.length !== input.roleIds.length) throw new Error("BAD_REQUEST:Select valid roles for this user.");
    const activeSuperAdmins = await db.user.count({ where: { companyId: session.user.companyId, status: "ACTIVE", roles: { some: { role: { name: "SUPER_ADMIN" } } } } });
    const existingIsSuperAdmin = existing.roles.some((item) => item.role.name === "SUPER_ADMIN");
    const updatedIsSuperAdmin = roles.some((role) => role.name === "SUPER_ADMIN");
    if (existingIsSuperAdmin && activeSuperAdmins <= 1 && (input.status !== "ACTIVE" || !updatedIsSuperAdmin)) throw new Error("CONFLICT:The last active SUPER_ADMIN cannot be removed or deactivated.");
    const duplicate = await db.user.findFirst({ where: { email: input.email, NOT: { id } }, select: { id: true } });
    if (duplicate) throw new Error("CONFLICT:A user with this email already exists.");
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { name: input.name, email: input.email, status: input.status, ...(input.password ? { passwordHash: await passwordHash(input.password) } : {}), roles: { deleteMany: {}, create: roles.map((role) => ({ roleId: role.id })) } }, select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, roles: { select: { role: { select: { id: true, name: true } } } } } });
      if (input.password || input.status === "INACTIVE") {
        await tx.session.deleteMany({ where: { userId: id, ...(id === session.user.id && input.status === "ACTIVE" ? { NOT: { id: session.sessionId } } : {}) } });
      }
      await tx.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "USER_UPDATED", entityType: "User", entityId: id, previousValue: { name: existing.name, email: existing.email, status: existing.status, roles: existing.roles.map((item) => item.role.name) }, newValue: { name: updated.name, email: updated.email, status: updated.status, roles: roles.map((role) => role.name) } } });
      await tx.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "INFO", title: "User access updated", message: `${updated.name}'s access settings were updated.`, entityType: "User", entityId: id, href: "/?view=Manage%20users" } });
      return updated;
    });
    return NextResponse.json({ data: { ...user, roles: user.roles.map((item) => ({ id: item.role.id, name: item.role.name })) } });
  } catch (error) { return jsonError(error); }
}
