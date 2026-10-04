import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { parseDateRange } from "@/lib/server/query";
import { parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("report.read");
    const { from, to } = parseDateRange(request.nextUrl.searchParams);
    const format = request.nextUrl.searchParams.get("format");
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const data = await db.$queryRaw<Array<{ productId: string; name: string; sku: string | null; unit: string; quantity: string; taxableValue: string; total: string }>>(Prisma.sql`SELECT p."id" AS "productId", p."name", p."sku", p."unit", SUM(ii."quantity") AS "quantity", SUM(ii."taxableValue") AS "taxableValue", SUM(ii."lineAmount") AS "total" FROM "InvoiceItem" ii INNER JOIN "Invoice" i ON i."id" = ii."invoiceId" INNER JOIN "Product" p ON p."id" = ii."productId" WHERE i."companyId" = ${session.user.companyId} AND i."invoiceDate" >= ${from} AND i."invoiceDate" <= ${to} AND i."status" NOT IN ('DRAFT', 'CANCELLED') GROUP BY p."id", p."name", p."sku", p."unit" ORDER BY p."name" ${format === "csv" ? Prisma.empty : Prisma.sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`}`);
    const totalResult = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM (SELECT p."id" FROM "InvoiceItem" ii INNER JOIN "Invoice" i ON i."id" = ii."invoiceId" INNER JOIN "Product" p ON p."id" = ii."productId" WHERE i."companyId" = ${session.user.companyId} AND i."invoiceDate" >= ${from} AND i."invoiceDate" <= ${to} AND i."status" NOT IN ('DRAFT', 'CANCELLED') GROUP BY p."id") grouped`);
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const csv = ["Product,SKU,Unit,Quantity,Taxable Value,Total", ...data.map((row) => [`"${row.name.replaceAll('"', '""')}"`, row.sku ?? "", row.unit, row.quantity, row.taxableValue, row.total].join(","))].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=product-sales-report.csv" } });
    }
    return NextResponse.json({ data, page, pageSize, total: Number(totalResult[0]?.count ?? 0) });
  } catch (error) { return jsonError(error); }
}
