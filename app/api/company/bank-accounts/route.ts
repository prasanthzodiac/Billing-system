import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";
import { bankAccountSchema } from "@/lib/server/schemas";

export async function GET() {
  try {
    const session = await requirePermission("admin.write");
    const data = await db.bankAccount.findMany({ where: { companyId: session.user.companyId, active: true }, orderBy: { id: "asc" } });
    return NextResponse.json({ data });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const input = bankAccountSchema.parse(await readJson(request));
    const data = await db.bankAccount.create({ data: { ...input, companyId: session.user.companyId } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "BANK_ACCOUNT_CREATED", entityType: "BankAccount", entityId: data.id, newValue: { bankName: data.bankName, accountHolder: data.accountHolder, ifsc: data.ifsc } } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
