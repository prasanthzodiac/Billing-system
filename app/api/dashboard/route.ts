import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { syncOverdueStatuses } from "@/lib/server/invoice-status";
import { indiaPeriodStarts } from "@/lib/financial";

export async function GET() {
  try {
    const session = await requireAnyPermission("dashboard.read", "report.read");
    const companyId = session.user.companyId;
    await syncOverdueStatuses(companyId);
    const { dayStart, monthStart, quarterStart, yearStart } = indiaPeriodStarts();
    const [today, month, quarter, year, invoices, outstanding, paid, overdue, customers, products, recentInvoices, lowStock] = await Promise.all([
      db.invoice.aggregate({ where: { companyId, invoiceDate: { gte: dayStart }, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { grandTotal: true } }),
      db.invoice.aggregate({ where: { companyId, invoiceDate: { gte: monthStart }, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { grandTotal: true } }),
      db.invoice.aggregate({ where: { companyId, invoiceDate: { gte: quarterStart }, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { grandTotal: true } }),
      db.invoice.aggregate({ where: { companyId, invoiceDate: { gte: yearStart }, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { grandTotal: true } }),
      db.invoice.count({ where: { companyId } }),
      db.invoice.aggregate({ where: { companyId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, _sum: { grandTotal: true, amountPaid: true } }),
      db.invoice.aggregate({ where: { companyId, status: "PAID" }, _sum: { grandTotal: true } }),
      db.invoice.aggregate({ where: { companyId, status: "OVERDUE" }, _sum: { grandTotal: true, amountPaid: true } }),
      db.customer.count({ where: { companyId, active: true } }),
      db.product.count({ where: { companyId, active: true } }),
      db.invoice.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, invoiceNumber: true, buyerName: true, invoiceDate: true, grandTotal: true, amountPaid: true, status: true } }),
      db.$queryRaw<Array<{ id: string; name: string; minimumStock: string; stock: string }>>(Prisma.sql`SELECT p."id", p."name", p."minimumStock", COALESCE(SUM(m."quantity"), 0) AS "stock" FROM "Product" p LEFT JOIN "InventoryMovement" m ON m."productId" = p."id" WHERE p."companyId" = ${companyId} AND p."active" = true GROUP BY p."id", p."name", p."minimumStock" HAVING COALESCE(SUM(m."quantity"), 0) <= p."minimumStock" ORDER BY p."name" LIMIT 100`)
    ]);
    const lowStockProducts = lowStock.map((product) => ({ id: product.id, name: product.name, stock: Number(product.stock), minimumStock: product.minimumStock.toString() }));
    const outstandingAmount = new Decimal(outstanding._sum.grandTotal?.toString() ?? "0").minus(outstanding._sum.amountPaid?.toString() ?? "0");
    const overdueAmount = new Decimal(overdue._sum.grandTotal?.toString() ?? "0").minus(overdue._sum.amountPaid?.toString() ?? "0");
    return NextResponse.json({ metrics: { todaySales: today._sum.grandTotal?.toString() ?? "0", monthSales: month._sum.grandTotal?.toString() ?? "0", quarterSales: quarter._sum.grandTotal?.toString() ?? "0", yearSales: year._sum.grandTotal?.toString() ?? "0", totalInvoices: invoices, outstanding: outstandingAmount.toFixed(2), paid: paid._sum.grandTotal?.toString() ?? "0", overdue: overdueAmount.toFixed(2), customers, products, lowStock: lowStockProducts.length }, recentInvoices, lowStockProducts });
  } catch (error) { return jsonError(error); }
}
