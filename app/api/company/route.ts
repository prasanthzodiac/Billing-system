import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { companySettingsSchema } from "@/lib/server/schemas";
import { readJson } from "@/lib/server/query";

export async function GET() {
  try {
    const session = await requirePermission("admin.write");
    const company = await db.company.findUnique({ where: { id: session.user.companyId }, include: { bankAccounts: { where: { active: true }, orderBy: { id: "asc" } } } });
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });
    const { bankAccounts, ...data } = company;
    return NextResponse.json({ data: { ...data, bankAccounts, bankAccount: bankAccounts[0] ?? null } });
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const input = companySettingsSchema.parse(await readJson(request));
    const { bankAccount, ...companyData } = input;
    const company = await db.$transaction(async (tx) => {
      const updated = await tx.company.update({ where: { id: session.user.companyId }, data: companyData });
      if (bankAccount) {
        const existing = await tx.bankAccount.findFirst({ where: { companyId: session.user.companyId, active: true }, orderBy: { id: "asc" } });
        if (existing) await tx.bankAccount.update({ where: { id: existing.id }, data: bankAccount });
        else await tx.bankAccount.create({ data: { ...bankAccount, companyId: session.user.companyId } });
      }
      await tx.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "COMPANY_SETTINGS_UPDATED", entityType: "Company", entityId: updated.id, newValue: { ...companyData, bankAccount: bankAccount ? { bankName: bankAccount.bankName, accountHolder: bankAccount.accountHolder, ifsc: bankAccount.ifsc } : undefined } } });
      return updated;
    });
    return NextResponse.json({ data: company });
  } catch (error) { return jsonError(error); }
}
