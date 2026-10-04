import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { parseDateRange, parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("report.read");
    const { from, to } = parseDateRange(request.nextUrl.searchParams);
    const format = request.nextUrl.searchParams.get("format");
    const where: Prisma.InvoiceWhereInput = { companyId: session.user.companyId, invoiceDate: { gte: from, lte: to }, status: { notIn: ["DRAFT", "CANCELLED"] } };
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const [invoices, total] = await Promise.all([
      db.invoice.findMany({ where, orderBy: { invoiceDate: "asc" }, ...(format === "csv" ? {} : { skip: (page - 1) * pageSize, take: pageSize }), select: { invoiceDate: true, invoiceNumber: true, buyerName: true, taxableAmount: true, totalTax: true, grandTotal: true, amountPaid: true, status: true } }),
      db.invoice.count({ where })
    ]);
    if (format === "csv") {
      const rows = ["Date,Invoice,Customer,Taxable Amount,Tax,Grand Total,Paid,Status", ...invoices.map((invoice) => [invoice.invoiceDate.toISOString().slice(0, 10), invoice.invoiceNumber ?? "", csv(invoice.buyerName), invoice.taxableAmount.toString(), invoice.totalTax.toString(), invoice.grandTotal.toString(), invoice.amountPaid.toString(), invoice.status].join(","))];
      return new Response(rows.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=sales-report.csv" } });
    }
    return NextResponse.json({ data: invoices, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}

function csv(value: string) { return `"${value.replaceAll('"', '""')}"`; }
