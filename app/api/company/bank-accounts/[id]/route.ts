import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";
import { bankAccountSchema } from "@/lib/server/schemas";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const { id } = await context.params;
    const existing = await db.bankAccount.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) return NextResponse.json({ error: "Bank account not found." }, { status: 404 });
    const input = bankAccountSchema.parse(await readJson(request));
    const data = await db.bankAccount.update({ where: { id }, data: input });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "BANK_ACCOUNT_UPDATED", entityType: "BankAccount", entityId: id, previousValue: { bankName: existing.bankName, accountHolder: existing.accountHolder, ifsc: existing.ifsc }, newValue: { bankName: data.bankName, accountHolder: data.accountHolder, ifsc: data.ifsc } } });
    return NextResponse.json({ data });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const { id } = await context.params;
    const existing = await db.bankAccount.findFirst({ where: { id, companyId: session.user.companyId, active: true } });
    if (!existing) return NextResponse.json({ error: "Bank account not found." }, { status: 404 });
    const data = await db.bankAccount.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "BANK_ACCOUNT_DISABLED", entityType: "BankAccount", entityId: id, previousValue: { bankName: existing.bankName, accountHolder: existing.accountHolder }, newValue: { active: false } } });
    return NextResponse.json({ data });
  } catch (error) { return jsonError(error); }
}
