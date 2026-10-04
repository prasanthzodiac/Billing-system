import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { productSchema } from "@/lib/server/schemas";
import { readJson } from "@/lib/server/query";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("master.write");
    const { id } = await context.params;
    const input = productSchema.parse(await readJson(request));
    const existing = await db.product.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) throw new Error("BAD_REQUEST:Product was not found.");
    if (input.sku) {
      const duplicate = await db.product.findFirst({ where: { companyId: session.user.companyId, sku: input.sku, NOT: { id } } });
      if (duplicate) throw new Error("CONFLICT:Another product already uses this SKU.");
    }
    const product = await db.product.update({ where: { id }, data: { name: input.name, description: input.description, sku: input.sku, hsnSac: input.hsnSac, unit: input.unit, defaultRate: input.defaultRate, purchaseRate: input.purchaseRate, gstRate: input.gstRate, minimumStock: input.minimumStock, active: input.active } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: id, previousValue: { name: existing.name, defaultRate: existing.defaultRate.toString(), gstRate: existing.gstRate.toString(), active: existing.active }, newValue: { name: product.name, defaultRate: product.defaultRate.toString(), gstRate: product.gstRate.toString(), active: product.active } } });
    await db.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "INFO", title: "Product updated", message: `${product.name} details were updated.`, entityType: "Product", entityId: id, href: "/?view=Products" } });
    return NextResponse.json({ data: product });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("master.write");
    const { id } = await context.params;
    const existing = await db.product.findFirst({ where: { id, companyId: session.user.companyId } });
    if (!existing) throw new Error("BAD_REQUEST:Product was not found.");
    const product = await db.product.update({ where: { id }, data: { active: false } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "PRODUCT_DISABLED", entityType: "Product", entityId: id, previousValue: { active: existing.active }, newValue: { active: false } } });
    await db.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "WARNING", title: "Product disabled", message: `${existing.name} is no longer available for new invoices.`, entityType: "Product", entityId: id, href: "/?view=Products" } });
    return NextResponse.json({ data: product });
  } catch (error) { return jsonError(error); }
}
