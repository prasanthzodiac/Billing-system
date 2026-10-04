import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("report.read");
    const format = request.nextUrl.searchParams.get("format");
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const data = await db.$queryRaw<Array<{ id: string; name: string; sku: string | null; unit: string; minimumStock: string; openingStock: string; stockIn: string; stockOut: string; closingStock: string }>>(Prisma.sql`SELECT p."id", p."name", p."sku", p."unit", p."minimumStock", COALESCE(SUM(m."quantity") FILTER (WHERE m."type" = 'OPENING'), 0) AS "openingStock", COALESCE(SUM(m."quantity") FILTER (WHERE m."type" IN ('PURCHASE', 'ADJUSTMENT_IN', 'RETURN', 'SALE_REVERSAL')), 0) AS "stockIn", COALESCE(SUM(ABS(m."quantity")) FILTER (WHERE m."type" IN ('SALE', 'ADJUSTMENT_OUT', 'DAMAGE')), 0) AS "stockOut", COALESCE(SUM(m."quantity"), 0) AS "closingStock" FROM "Product" p LEFT JOIN "InventoryMovement" m ON m."productId" = p."id" WHERE p."companyId" = ${session.user.companyId} AND p."active" = true GROUP BY p."id", p."name", p."sku", p."unit", p."minimumStock" ORDER BY p."name" ${format === "csv" ? Prisma.empty : Prisma.sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`}`);
    const totalResult = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "Product" p WHERE p."companyId" = ${session.user.companyId} AND p."active" = true`);
    if (format === "csv") {
      const csv = ["Product,SKU,Unit,Opening Stock,Stock In,Stock Out,Closing Stock,Minimum Stock", ...data.map((row) => [csvValue(row.name), row.sku ?? "", row.unit, row.openingStock, row.stockIn, row.stockOut, row.closingStock, row.minimumStock].join(","))].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=inventory-report.csv" } });
    }
    return NextResponse.json({ data, page, pageSize, total: Number(totalResult[0]?.count ?? 0) });
  } catch (error) { return jsonError(error); }
}

function csvValue(value: string) { return `"${value.replaceAll('"', '""')}"`; }
