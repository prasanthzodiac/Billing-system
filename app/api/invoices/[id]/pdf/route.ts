import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { renderInvoicePdf } from "@/lib/server/invoice-pdf";
import { jsonError } from "@/lib/server/http";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission("invoice.create", "report.read");
    const { id } = await context.params;
    const invoice = await db.invoice.findFirst({ where: { id, companyId: session.user.companyId }, include: { company: { include: { bankAccounts: { where: { active: true }, take: 1 } } }, items: true } });
    if (!invoice) return new Response("Not found", { status: 404 });
    const snapshotRows = await db.$queryRaw<Array<{ companySnapshot: unknown }>>(Prisma.sql`SELECT "companySnapshot" FROM "Invoice" WHERE "id" = ${invoice.id}`);
    const snapshotValue = snapshotRows[0]?.companySnapshot;
    const snapshot = snapshotValue && typeof snapshotValue === "object" && !Array.isArray(snapshotValue) ? snapshotValue as Record<string, unknown> : null;
    const snapshotBank = snapshot?.bankAccount && typeof snapshot.bankAccount === "object" && !Array.isArray(snapshot.bankAccount) ? [snapshot.bankAccount] as typeof invoice.company.bankAccounts : null;
    const company = snapshot ? { ...invoice.company, ...snapshot } : invoice.company;
    const bytes = await renderInvoicePdf({ ...invoice, company: company as typeof invoice.company, companyBankAccounts: snapshotBank ?? invoice.company.bankAccounts });
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${invoice.invoiceNumber ?? invoice.id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return jsonError(error); }
}
