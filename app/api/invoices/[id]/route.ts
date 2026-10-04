import { NextRequest, NextResponse } from "next/server";

import { requireAnyPermission, requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { deleteDraft, updateDraft } from "@/lib/server/invoice-service";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission("invoice.create", "report.read");
    const { id } = await context.params;
    const invoice = await db.invoice.findFirst({ where: { id, companyId: session.user.companyId }, include: { items: { orderBy: { serialNumber: "asc" } }, payments: { orderBy: { paymentDate: "asc" }, select: { id: true, amount: true, paymentDate: true, method: true, referenceNumber: true, bank: true, notes: true, reversedAt: true, reversalReason: true } } } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json({ data: invoice });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("invoice.create");
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const result = await updateDraft({ ...body, invoiceId: id }, session.user.id, session.user.companyId);
    return NextResponse.json({ data: result });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("invoice.create");
    const { id } = await context.params;
    const result = await deleteDraft(id, session.user.id, session.user.companyId);
    return NextResponse.json({ data: result });
  } catch (error) { return jsonError(error); }
}
