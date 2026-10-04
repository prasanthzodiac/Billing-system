import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { parseOptionalDateRange, parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAnyPermission("payment.create", "report.read");
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const paymentDate = parseOptionalDateRange(request.nextUrl.searchParams);
    const where: Prisma.PaymentWhereInput = { invoice: { companyId: session.user.companyId }, ...(paymentDate ? { paymentDate } : {}), ...(query ? { OR: [{ referenceNumber: { contains: query, mode: "insensitive" } }, { invoice: { buyerName: { contains: query, mode: "insensitive" } } }, { invoice: { invoiceNumber: { contains: query, mode: "insensitive" } } }] } : {}) };
    const [payments, total] = await Promise.all([
      db.payment.findMany({ where, orderBy: { paymentDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, invoiceId: true, amount: true, paymentDate: true, method: true, referenceNumber: true, bank: true, notes: true, reversedAt: true, reversalReason: true, invoice: { select: { invoiceNumber: true, buyerName: true, grandTotal: true } } } }),
      db.payment.count({ where })
    ]);
    return NextResponse.json({ data: payments, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}
