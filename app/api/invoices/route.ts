import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { syncOverdueStatuses } from "@/lib/server/invoice-status";
import { parseInvoiceMonth, parseInvoiceStatus, parseOptionalDateRange, parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAnyPermission("invoice.create", "report.read");
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    await syncOverdueStatuses(session.user.companyId);
    const status = parseInvoiceStatus(request.nextUrl.searchParams.get("status"));
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const invoiceDate = parseOptionalDateRange(request.nextUrl.searchParams);
    const month = parseInvoiceMonth(request.nextUrl.searchParams.get("month"));
    const currentYear = new Date().getUTCFullYear();
    const monthRanges = month && !invoiceDate ? Array.from({ length: 31 }, (_, index) => {
      const year = currentYear - index;
      return { invoiceDate: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } };
    }) : [];
    const filters: Prisma.InvoiceWhereInput[] = [];
    if (monthRanges.length) filters.push({ OR: monthRanges });
    if (query) filters.push({ OR: [{ invoiceNumber: { contains: query, mode: "insensitive" } }, { buyerName: { contains: query, mode: "insensitive" } }, { buyerGstin: { contains: query, mode: "insensitive" } }, { vehicleNumber: { contains: query, mode: "insensitive" } }, { lrRrNumber: { contains: query, mode: "insensitive" } }, { billOfLadingNumber: { contains: query, mode: "insensitive" } }, { items: { some: { OR: [{ productName: { contains: query, mode: "insensitive" } }, { hsnSac: { contains: query, mode: "insensitive" } }] } } }] });
    const where: Prisma.InvoiceWhereInput = { companyId: session.user.companyId, ...(status ? { status } : {}), ...(invoiceDate ? { invoiceDate } : {}), ...(filters.length ? { AND: filters } : {}) };
    const [data, total] = await Promise.all([db.invoice.findMany({ where, orderBy: { invoiceDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, invoiceNumber: true, invoiceDate: true, buyerName: true, buyerGstin: true, type: true, status: true, grandTotal: true, amountPaid: true, vehicleNumber: true, billOfLadingNumber: true, lrRrNumber: true, ewayBillNumber: true, ewayBillStatus: true } }), db.invoice.count({ where })]);
    return NextResponse.json({ data, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}
