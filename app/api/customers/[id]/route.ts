import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { customerSchema } from "@/lib/server/schemas";
import { readJson } from "@/lib/server/query";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("master.write");
    const { id } = await context.params;
    const input = customerSchema.parse(await readJson(request));
    const existing = await db.customer.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) throw new Error("BAD_REQUEST:Customer was not found.");
    if (input.gstin) {
      const duplicate = await db.customer.findFirst({ where: { companyId: session.user.companyId, gstin: input.gstin, NOT: { id } } });
      if (duplicate) throw new Error("CONFLICT:Another customer already uses this GSTIN.");
    }
    const customer = await db.customer.update({ where: { id }, data: input });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "CUSTOMER_UPDATED", entityType: "Customer", entityId: id, previousValue: { name: existing.name, billingAddress: existing.billingAddress, gstin: existing.gstin, active: existing.active }, newValue: { name: customer.name, billingAddress: customer.billingAddress, gstin: customer.gstin, active: customer.active } } });
    await db.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "INFO", title: "Customer updated", message: `${customer.name} details were updated.`, entityType: "Customer", entityId: id, href: "/?view=Customers" } });
    return NextResponse.json({ data: customer });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("master.write");
    const { id } = await context.params;
    const existing = await db.customer.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) throw new Error("BAD_REQUEST:Customer was not found.");
    const customer = await db.customer.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "CUSTOMER_DISABLED", entityType: "Customer", entityId: id, previousValue: { active: existing.active }, newValue: { active: false } } });
    await db.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "WARNING", title: "Customer disabled", message: `${existing.name} is no longer available for new invoices.`, entityType: "Customer", entityId: id, href: "/?view=Customers" } });
    return NextResponse.json({ data: customer });
  } catch (error) { return jsonError(error); }
}
