import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { productSchema } from "@/lib/server/schemas";
import { parsePagination, readJson } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAnyPermission("invoice.create", "master.write", "report.read");
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const where = { companyId: session.user.companyId, active: true, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { sku: { contains: query, mode: "insensitive" as const } }, { hsnSac: { contains: query, mode: "insensitive" as const } }] } : {}) };
    const [products, total] = await Promise.all([db.product.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }), db.product.count({ where })]);
    const stockRows = products.length ? await db.$queryRaw<Array<{ productId: string; currentStock: string }>>(Prisma.sql`SELECT "productId", COALESCE(SUM("quantity"), 0) AS "currentStock" FROM "InventoryMovement" WHERE "productId" IN (${Prisma.join(products.map((product) => product.id))}) GROUP BY "productId"`) : [];
    const stockByProduct = new Map(stockRows.map((row) => [row.productId, row.currentStock.toString()]));
    const data = products.map((product) => ({ ...product, currentStock: stockByProduct.get(product.id) ?? "0" }));
    return NextResponse.json({ data, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireAnyPermission("master.write");
    const input = productSchema.parse(await readJson(request));
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...input, companyId: session.user.companyId } });
      const opening = new (await import("decimal.js")).default(input.openingStock).isZero() ? null : await tx.inventoryMovement.create({ data: { productId: created.id, userId: session.user.id, type: "OPENING", quantity: input.openingStock, previousQty: "0", newQty: input.openingStock, notes: "Opening stock" } });
      return { created, openingId: opening?.id };
    });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.created.id, newValue: product.created } });
    await db.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "SUCCESS", title: "Product added", message: `${product.created.name} is ready for invoicing.`, entityType: "Product", entityId: product.created.id, href: "/?view=Products" } });
    return NextResponse.json({ data: product.created }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
