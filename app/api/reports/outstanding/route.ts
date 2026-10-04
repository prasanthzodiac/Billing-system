import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { syncOverdueStatuses } from "@/lib/server/invoice-status";
import { parseOptionalDateRange, parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("report.read");
    await syncOverdueStatuses(session.user.companyId);
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 200);
    const format = request.nextUrl.searchParams.get("format");
    const outstandingStatuses: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const invoiceDate = parseOptionalDateRange(request.nextUrl.searchParams);
    const where: Prisma.InvoiceWhereInput = { companyId: session.user.companyId, status: { in: outstandingStatuses }, ...(invoiceDate ? { invoiceDate } : {}), ...(query ? { OR: [{ invoiceNumber: { contains: query, mode: "insensitive" } }, { buyerName: { contains: query, mode: "insensitive" } }] } : {}) };
    const [invoices, total] = await Promise.all([db.invoice.findMany({ where, orderBy: { invoiceDate: "asc" }, ...(format === "csv" ? {} : { skip: (page - 1) * pageSize, take: pageSize }), select: { id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, buyerName: true, grandTotal: true, amountPaid: true, status: true } }), db.invoice.count({ where })]);
    const data = invoices.map((invoice) => { const outstanding = new Decimal(invoice.grandTotal.toString()).minus(invoice.amountPaid.toString()); const ageBase = invoice.dueDate ?? invoice.invoiceDate; const age = Math.max(0, Math.floor((Date.now() - ageBase.getTime()) / 86400000)); return { ...invoice, grandTotal: invoice.grandTotal.toString(), amountPaid: invoice.amountPaid.toString(), outstanding: outstanding.toFixed(2), age }; });
    if (format === "csv") {
      const csv = ["Invoice,Customer,Invoice Date,Grand Total,Paid,Outstanding,Age,Status", ...data.map((row) => [row.invoiceNumber ?? "", csvValue(row.buyerName), row.invoiceDate.toISOString().slice(0, 10), row.grandTotal, row.amountPaid, row.outstanding, row.age, row.status].join(","))].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=outstanding-report.csv" } });
    }
    return NextResponse.json({ data, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}

function csvValue(value: string) { return `"${value.replaceAll('"', '""')}"`; }
