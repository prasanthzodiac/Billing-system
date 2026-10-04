import { NextRequest, NextResponse } from "next/server";
import Decimal from "decimal.js";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { parseDateRange } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("report.read");
    const customerId = request.nextUrl.searchParams.get("customerId");
    if (!customerId) throw new Error("BAD_REQUEST:Customer is required.");
    const { from, to } = parseDateRange(request.nextUrl.searchParams);
    const customer = await db.customer.findFirst({ where: { id: customerId, companyId: session.user.companyId }, select: { id: true, name: true, openingBalance: true } });
    if (!customer) throw new Error("BAD_REQUEST:Customer was not found.");
    const [openingInvoices, openingPayments, invoices, payments] = await Promise.all([
      db.invoice.aggregate({ where: { companyId: session.user.companyId, customerId, invoiceDate: { lt: from }, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { grandTotal: true } }),
      db.payment.aggregate({ where: { customerId, paymentDate: { lt: from }, reversedAt: null, invoice: { companyId: session.user.companyId } }, _sum: { amount: true } }),
      db.invoice.findMany({ where: { companyId: session.user.companyId, customerId, invoiceDate: { gte: from, lte: to }, status: { notIn: ["DRAFT", "CANCELLED"] } }, orderBy: { invoiceDate: "asc" }, select: { id: true, invoiceNumber: true, invoiceDate: true, grandTotal: true } }),
      db.payment.findMany({ where: { customerId, paymentDate: { gte: from, lte: to }, reversedAt: null, invoice: { companyId: session.user.companyId } }, orderBy: { paymentDate: "asc" }, select: { id: true, invoiceId: true, paymentDate: true, amount: true, method: true, referenceNumber: true } })
    ]);
    const transactions = [...invoices.map((invoice) => ({ date: invoice.invoiceDate, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, debit: new Decimal(invoice.grandTotal.toString()), credit: new Decimal(0), description: "Invoice" })), ...payments.map((payment) => ({ date: payment.paymentDate, invoiceId: payment.invoiceId, invoiceNumber: null, debit: new Decimal(0), credit: new Decimal(payment.amount.toString()), description: "Payment · " + payment.method }))].sort((a, b) => a.date.getTime() - b.date.getTime());
    const openingBalance = new Decimal(customer.openingBalance.toString()).plus(openingInvoices._sum.grandTotal?.toString() ?? "0").minus(openingPayments._sum.amount?.toString() ?? "0");
    let balance = openingBalance;
    const data = transactions.map((item) => { balance = balance.plus(item.debit).minus(item.credit); return { date: item.date, invoiceId: item.invoiceId, invoiceNumber: item.invoiceNumber, description: item.description, debit: item.debit.toFixed(2), credit: item.credit.toFixed(2), balance: balance.toFixed(2) }; });
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const csv = ["Date,Invoice,Description,Debit,Credit,Running Balance", ...data.map((row) => [row.date.toISOString().slice(0, 10), row.invoiceNumber ?? "", `"${row.description.replaceAll('"', '""')}"`, row.debit, row.credit, row.balance].join(","))].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=customer-statement.csv" } });
    }
    return NextResponse.json({ customer: { id: customer.id, name: customer.name }, openingBalance: openingBalance.toFixed(2), data, totalDebit: data.reduce((sum, row) => sum.plus(row.debit), new Decimal(0)).toFixed(2), totalCredit: data.reduce((sum, row) => sum.plus(row.credit), new Decimal(0)).toFixed(2), closingBalance: balance.toFixed(2) });
  } catch (error) { return jsonError(error); }
}
