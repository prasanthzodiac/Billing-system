import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";
import { transporterSchema } from "@/lib/server/schemas";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const { id } = await context.params;
    const input = transporterSchema.parse(await readJson(request));
    const existing = await db.transporter.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "Transporter not found." }, { status: 404 });
    const transporter = await db.transporter.update({ where: { id }, data: input });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "TRANSPORTER_UPDATED", entityType: "Transporter", entityId: id, previousValue: { name: existing.name, active: existing.active }, newValue: { name: transporter.name, active: transporter.active } } });
    return NextResponse.json({ data: transporter });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const { id } = await context.params;
    const existing = await db.transporter.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "Transporter not found." }, { status: 404 });
    const transporter = await db.transporter.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "TRANSPORTER_DISABLED", entityType: "Transporter", entityId: id, previousValue: { name: existing.name, active: existing.active }, newValue: { active: false } } });
    return NextResponse.json({ data: transporter });
  } catch (error) { return jsonError(error); }
}
