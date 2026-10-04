import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/server/db";

/**
 * Keeps persisted invoice status aligned with due date and authoritative payment totals.
 * This is intentionally safe to call during reads when no scheduler is available.
 */
export async function syncOverdueStatuses(companyId: string) {
  const now = new Date();
  const currentBusinessDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await db.$transaction([
    db.$executeRaw(Prisma.sql`UPDATE "Invoice" SET "status" = CAST('OVERDUE' AS "InvoiceStatus"), "updatedAt" = NOW() WHERE "companyId" = ${companyId} AND "status" IN (CAST('ISSUED' AS "InvoiceStatus"), CAST('PARTIALLY_PAID' AS "InvoiceStatus")) AND "dueDate" IS NOT NULL AND "dueDate" < ${currentBusinessDate} AND "amountPaid" < "grandTotal"`),
    db.$executeRaw(Prisma.sql`UPDATE "Invoice" SET "status" = CAST('PAID' AS "InvoiceStatus"), "updatedAt" = NOW() WHERE "companyId" = ${companyId} AND "status" = CAST('OVERDUE' AS "InvoiceStatus") AND "amountPaid" >= "grandTotal"`),
    db.$executeRaw(Prisma.sql`UPDATE "Invoice" SET "status" = CASE WHEN "amountPaid" = 0 THEN CAST('ISSUED' AS "InvoiceStatus") ELSE CAST('PARTIALLY_PAID' AS "InvoiceStatus") END, "updatedAt" = NOW() WHERE "companyId" = ${companyId} AND "status" = CAST('OVERDUE' AS "InvoiceStatus") AND ("dueDate" IS NULL OR "dueDate" >= ${currentBusinessDate}) AND "amountPaid" < "grandTotal"`)
  ]);
}
