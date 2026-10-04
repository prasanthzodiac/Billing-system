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
    const data = await db.$queryRaw<Array<{ hsnSac: string; gstPercent: string; quantity: string; taxableValue: string; cgst: string; sgst: string; igst: string; total: string }>>(Prisma.sql`SELECT ii."hsnSac", ii."gstPercent", SUM(ii."quantity") AS "quantity", SUM(ii."taxableValue") AS "taxableValue", SUM(ii."cgstAmount") AS "cgst", SUM(ii."sgstAmount") AS "sgst", SUM(ii."igstAmount") AS "igst", SUM(ii."lineAmount") AS "total" FROM "InvoiceItem" ii INNER JOIN "Invoice" i ON i."id" = ii."invoiceId" WHERE i."companyId" = ${session.user.companyId} AND i."invoiceDate" >= ${from} AND i."invoiceDate" <= ${to} AND i."status" NOT IN ('DRAFT', 'CANCELLED') GROUP BY ii."hsnSac", ii."gstPercent" ORDER BY ii."hsnSac", ii."gstPercent" ${format === "csv" ? Prisma.empty : Prisma.sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`}`);
    const totalResult = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM (SELECT ii."hsnSac", ii."gstPercent" FROM "InvoiceItem" ii INNER JOIN "Invoice" i ON i."id" = ii."invoiceId" WHERE i."companyId" = ${session.user.companyId} AND i."invoiceDate" >= ${from} AND i."invoiceDate" <= ${to} AND i."status" NOT IN ('DRAFT', 'CANCELLED') GROUP BY ii."hsnSac", ii."gstPercent") grouped`);
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const csv = ["HSN/SAC,GST %,Quantity,Taxable Value,CGST,SGST,IGST,Total", ...data.map((row) => [row.hsnSac, row.gstPercent, row.quantity, row.taxableValue, row.cgst, row.sgst, row.igst, row.total].join(","))].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=gst-report.csv" } });
    }
    return NextResponse.json({ data, page, pageSize, total: Number(totalResult[0]?.count ?? 0) });
  } catch (error) { return jsonError(error); }
}
