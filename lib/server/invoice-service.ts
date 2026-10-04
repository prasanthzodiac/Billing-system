import "server-only";

import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { calculateDueDate, calculateInvoice, calculateLine, resolveTaxMode, formatFinancialYear, formatInvoiceNumber, type TaxMode } from "@/lib/financial";
import { db, runSerializableTransaction } from "@/lib/server/db";
import { createNotification } from "@/lib/server/notifications";
import { draftUpdateSchema, issueInvoiceSchema, type IssueInvoiceInput } from "@/lib/server/schemas";

type IssuedInvoiceResult = { invoiceId: string; invoiceNumber: string; grandTotal: string };
type DraftInvoiceResult = { invoiceId: string; grandTotal: string };

type DraftMutationResult = DraftInvoiceResult & { status: string };

// The local Prisma runtime can lag the database enum while its Windows query
// engine is locked by another process. Use a valid legacy enum value for the
// typed write, then persist the authoritative NO_GST value in the same
// transaction with SQL. A regenerated client will use NO_GST directly.
const prismaTaxMode = (mode: TaxMode) => (mode === "NO_GST" ? "INTRA_STATE" : mode) as "INTRA_STATE" | "INTER_STATE";

async function persistTaxMode(tx: Prisma.TransactionClient, invoiceId: string, mode: TaxMode) {
  if (mode === "NO_GST") await tx.$executeRaw(Prisma.sql`UPDATE "Invoice" SET "taxMode" = 'NO_GST'::"TaxMode" WHERE "id" = ${invoiceId}`);
}

function snapshotCompany(company: { name: string; addressLine1: string; addressLine2: string | null; city: string; district: string | null; state: string; stateCode: string; pinCode: string; gstin: string | null; pan: string | null; phone: string | null; email: string | null; website: string | null; logoUrl: string | null; defaultJurisdiction: string | null; declaration: string | null; authorizedSignatory: string | null; bankAccounts?: Array<{ id: string; bankName: string; accountHolder: string; accountNumber: string; ifsc: string; branch: string | null; accountType?: string | null }> }, bankAccountId?: string) {
  const { bankAccounts, ...identity } = company;
  const bankAccount = bankAccountId ? bankAccounts?.find((account) => account.id === bankAccountId) : bankAccounts?.[0];
  if (bankAccountId && !bankAccount) throw new Error("BAD_REQUEST:Selected bank account is missing or inactive.");
  return { ...identity, bankAccount: bankAccount ?? null };
}

async function persistCompanySnapshot(tx: Prisma.TransactionClient, invoiceId: string, snapshot: ReturnType<typeof snapshotCompany>) {
  await tx.$executeRaw(Prisma.sql`UPDATE "Invoice" SET "companySnapshot" = ${JSON.stringify(snapshot)}::jsonb WHERE "id" = ${invoiceId}`);
}

async function buildInvoiceItemData(tx: Prisma.TransactionClient, input: IssueInvoiceInput, companyId: string, customerId: string, companyStateCode: string) {
  const customer = await tx.customer.findFirst({ where: { id: customerId, companyId, active: true } });
  if (!customer) throw new Error("BAD_REQUEST:Customer is missing or inactive.");
  const taxMode = resolveTaxMode(companyStateCode, customer.stateCode, input.type === "BILL_OF_SUPPLY" ? "NO_GST" : input.taxMode);
  const calculatedLines = [];
  const itemData: Array<{ productId: string; productName: string; hsnSac: string; unit: string; quantity: string; rate: string; discountPercent: string; discountAmount: string; taxableValue: string; gstPercent: string; cgstAmount: string; sgstAmount: string; igstAmount: string; lineAmount: string; serialNumber: number }> = [];
  for (const [index, line] of input.items.entries()) {
    const product = await tx.product.findFirst({ where: { id: line.productId, companyId, active: true } });
    if (!product) throw new Error("BAD_REQUEST:One of the selected products is missing or inactive.");
    const calculationInput = taxMode === "NO_GST" ? { ...line, gstPercent: "0" } : line;
    const calculation = calculateLine(calculationInput, taxMode);
    calculatedLines.push(calculation);
    itemData.push({ serialNumber: index + 1, productId: product.id, productName: product.name, hsnSac: product.hsnSac, unit: product.unit, quantity: line.quantity, rate: line.rate, discountPercent: line.discountPercent, discountAmount: calculation.discountAmount.toFixed(2), taxableValue: calculation.taxableValue.toFixed(2), gstPercent: calculationInput.gstPercent, cgstAmount: calculation.cgst.toFixed(2), sgstAmount: calculation.sgst.toFixed(2), igstAmount: calculation.igst.toFixed(2), lineAmount: calculation.lineAmount.toFixed(2) });
  }
  return { customer, taxMode, calculatedLines, itemData, totals: calculateInvoice(calculatedLines) };
}

export async function saveDraft(rawInput: unknown): Promise<DraftInvoiceResult> {
  const input: IssueInvoiceInput = issueInvoiceSchema.parse(rawInput);
  return db.$transaction(async (tx) => {
    const previousRequest = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId: input.companyId, key: input.idempotencyKey } } });
    if (previousRequest) return previousRequest.response as DraftInvoiceResult;
    const company = await tx.company.findUnique({ where: { id: input.companyId }, include: { bankAccounts: { where: { active: true }, orderBy: { id: "asc" } } } });
    if (!company) throw new Error("Company was not found.");
    const prepared = await buildInvoiceItemData(tx, input, company.id, input.customerId, company.stateCode);
    const dueDate = calculateDueDate(input.invoiceDate, input.paymentTerms, prepared.customer.creditPeriod, company.defaultTerms);
    const invoice = await tx.invoice.create({ data: { companyId: company.id, customerId: prepared.customer.id, createdById: input.userId, invoiceDate: input.invoiceDate, dueDate, financialYear: formatFinancialYear(input.invoiceDate), type: input.type, status: "DRAFT", taxMode: prismaTaxMode(prepared.taxMode), deliveryNote: input.deliveryNote, referenceNumber: input.referenceNumber, referenceDate: input.referenceDate, paymentTerms: input.paymentTerms, buyerOrderNumber: input.buyerOrderNumber, buyerOrderDate: input.buyerOrderDate, dispatchDocumentNumber: input.dispatchDocumentNumber, deliveryNoteDate: input.deliveryNoteDate, buyerName: prepared.customer.name, buyerBillingAddress: prepared.customer.billingAddress, buyerDeliveryAddress: prepared.customer.deliveryAddress, buyerGstin: prepared.customer.gstin, buyerState: prepared.customer.state, buyerStateCode: prepared.customer.stateCode, buyerPhone: prepared.customer.phone, dispatchedThrough: input.dispatchedThrough, transporterName: input.transporterName, destination: input.destination, billOfLadingNumber: input.billOfLadingNumber, vehicleNumber: input.vehicleNumber, lrRrNumber: input.lrRrNumber, termsOfDelivery: input.termsOfDelivery, taxableAmount: prepared.totals.taxableValue.toFixed(2), cgstAmount: prepared.totals.cgst.toFixed(2), sgstAmount: prepared.totals.sgst.toFixed(2), igstAmount: prepared.totals.igst.toFixed(2), totalTax: prepared.totals.totalTax.toFixed(2), grandTotal: prepared.totals.grandTotal.toFixed(2), items: { create: prepared.itemData } } });
    await persistTaxMode(tx, invoice.id, prepared.taxMode);
    await persistCompanySnapshot(tx, invoice.id, snapshotCompany(company, input.bankAccountId));
    const response = { invoiceId: invoice.id, grandTotal: prepared.totals.grandTotal.toFixed(2) };
    await tx.idempotencyKey.create({ data: { companyId: company.id, key: input.idempotencyKey, command: "SAVE_DRAFT", entityId: invoice.id, response } });
    await tx.auditLog.create({ data: { companyId: company.id, userId: input.userId, invoiceId: invoice.id, action: "INVOICE_CREATED", entityType: "Invoice", entityId: invoice.id, newValue: response } });
    await createNotification(tx, company.id, input.userId, { type: "INFO", title: "Draft saved", message: `Draft for ${prepared.customer.name} is ready to review.`, entityType: "Invoice", entityId: invoice.id, href: "/?view=Create%20Invoice&draftId=" + invoice.id });
    return response;
  });
}

export async function issueInvoice(rawInput: unknown, existingDraftId?: string): Promise<IssuedInvoiceResult> {
  const input: IssueInvoiceInput = issueInvoiceSchema.parse(rawInput);
  return runSerializableTransaction(async (tx) => {
    const previousRequest = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId: input.companyId, key: input.idempotencyKey } } });
    if (previousRequest) return previousRequest.response as IssuedInvoiceResult;

    const [company, customer] = await Promise.all([
      tx.company.findUnique({ where: { id: input.companyId }, include: { bankAccounts: { where: { active: true }, orderBy: { id: "asc" } } } }),
      tx.customer.findFirst({ where: { id: input.customerId, companyId: input.companyId, active: true } })
    ]);
    if (!company) throw new Error("Company was not found.");
    if (!customer) throw new Error("BAD_REQUEST:Customer is missing or inactive.");

    const financialYear = formatFinancialYear(input.invoiceDate);
  const taxMode = resolveTaxMode(company.stateCode, customer.stateCode, input.type === "BILL_OF_SUPPLY" ? "NO_GST" : input.taxMode);
    const sequence = await tx.invoiceSequence.upsert({
      where: { companyId_financialYear: { companyId: company.id, financialYear } },
      create: { companyId: company.id, financialYear, lastValue: 1 },
      update: { lastValue: { increment: 1 } }
    });
    const invoiceNumber = formatInvoiceNumber(company.invoicePrefix, financialYear, sequence.lastValue);

    const calculatedLines = [];
    const startingBalances = new Map<string, Decimal>();
    const remainingBalances = new Map<string, Decimal>();
    const itemData: Array<{ productId: string; productName: string; hsnSac: string; unit: string; quantity: string; rate: string; discountPercent: string; discountAmount: string; taxableValue: string; gstPercent: string; cgstAmount: string; sgstAmount: string; igstAmount: string; lineAmount: string; serialNumber: number }> = [];

    for (const [index, line] of input.items.entries()) {
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${line.productId} AND "companyId" = ${company.id} FOR UPDATE`);
      const product = await tx.product.findFirst({ where: { id: line.productId, companyId: company.id, active: true } });
      if (!product) throw new Error("BAD_REQUEST:One of the selected products is missing or inactive.");
      const calculationInput = taxMode === "NO_GST" ? { ...line, gstPercent: "0" } : line;
      const calculation = calculateLine(calculationInput, taxMode);
      if (!startingBalances.has(product.id)) {
        const current = await tx.inventoryMovement.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
        const currentQty = new Decimal(current._sum.quantity?.toString() ?? "0");
        startingBalances.set(product.id, currentQty);
        remainingBalances.set(product.id, currentQty);
      }
      const currentQty = remainingBalances.get(product.id) ?? new Decimal(0);
      if (currentQty.lt(line.quantity)) throw new Error(`CONFLICT:${product.name} has insufficient stock. Available: ${currentQty.toString()}, required: ${line.quantity}.`);
      remainingBalances.set(product.id, currentQty.minus(line.quantity));
      calculatedLines.push(calculation);
      itemData.push({
        serialNumber: index + 1,
        productId: product.id,
        productName: product.name,
        hsnSac: product.hsnSac,
        unit: product.unit,
        quantity: line.quantity,
        rate: line.rate,
        discountPercent: line.discountPercent,
        discountAmount: calculation.discountAmount.toFixed(2),
        taxableValue: calculation.taxableValue.toFixed(2),
        gstPercent: calculationInput.gstPercent,
        cgstAmount: calculation.cgst.toFixed(2),
        sgstAmount: calculation.sgst.toFixed(2),
        igstAmount: calculation.igst.toFixed(2),
        lineAmount: calculation.lineAmount.toFixed(2)
      });
    }

    const totals = calculateInvoice(calculatedLines);
    const currentReceivable = await tx.invoice.aggregate({ where: { companyId: company.id, customerId: customer.id, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { grandTotal: true, amountPaid: true } });
    const receivable = new Decimal(customer.openingBalance.toString()).plus(currentReceivable._sum.grandTotal?.toString() ?? "0").minus(currentReceivable._sum.amountPaid?.toString() ?? "0");
    const creditLimit = new Decimal(customer.creditLimit.toString());
    if (creditLimit.gt(0) && receivable.plus(totals.grandTotal).gt(creditLimit)) {
      const availableCredit = creditLimit.minus(receivable);
      throw new Error(`CONFLICT:Credit limit exceeded. Available credit: ${(availableCredit.lt(0) ? new Decimal(0) : availableCredit).toFixed(2)}.`);
    }
    const dueDate = calculateDueDate(input.invoiceDate, input.paymentTerms, customer.creditPeriod, company.defaultTerms);
    const invoiceData = {
        companyId: company.id,
        customerId: customer.id,
        createdById: input.userId,
        invoiceNumber,
        invoiceDate: input.invoiceDate,
        financialYear,
        type: input.type,
        status: "ISSUED" as const,
        taxMode: prismaTaxMode(taxMode),
        dueDate,
        deliveryNote: input.deliveryNote,
        referenceNumber: input.referenceNumber,
        referenceDate: input.referenceDate,
        paymentTerms: input.paymentTerms,
        buyerOrderNumber: input.buyerOrderNumber,
        buyerOrderDate: input.buyerOrderDate,
        dispatchDocumentNumber: input.dispatchDocumentNumber,
        deliveryNoteDate: input.deliveryNoteDate,
        buyerName: customer.name,
        buyerBillingAddress: customer.billingAddress,
        buyerDeliveryAddress: customer.deliveryAddress,
        buyerGstin: customer.gstin,
        buyerState: customer.state,
        buyerStateCode: customer.stateCode,
        buyerPhone: customer.phone,
        dispatchedThrough: input.dispatchedThrough,
        transporterName: input.transporterName,
        destination: input.destination,
        billOfLadingNumber: input.billOfLadingNumber,
        vehicleNumber: input.vehicleNumber,
        lrRrNumber: input.lrRrNumber,
        termsOfDelivery: input.termsOfDelivery,
        taxableAmount: totals.taxableValue.toFixed(2),
        cgstAmount: totals.cgst.toFixed(2),
        sgstAmount: totals.sgst.toFixed(2),
        igstAmount: totals.igst.toFixed(2),
        totalTax: totals.totalTax.toFixed(2),
        grandTotal: totals.grandTotal.toFixed(2),
        issuedAt: new Date()
      };
    const invoice = existingDraftId
      ? await (async () => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${existingDraftId} AND "companyId" = ${company.id} FOR UPDATE`);
        const draft = await tx.invoice.findFirst({ where: { id: existingDraftId, companyId: company.id, status: "DRAFT" } });
        if (!draft) throw new Error("CONFLICT:Only a draft invoice can be issued from the editor.");
        await tx.invoiceItem.deleteMany({ where: { invoiceId: draft.id } });
        const updated = await tx.invoice.update({ where: { id: draft.id }, data: invoiceData });
        await tx.invoiceItem.createMany({ data: itemData.map((item) => ({ ...item, invoiceId: updated.id })) });
        return updated;
      })()
      : await tx.invoice.create({ data: { ...invoiceData, items: { create: itemData } } });

    await persistTaxMode(tx, invoice.id, taxMode);

    const movementBalances = new Map(startingBalances);
    for (const item of itemData) {
      const previousQty = movementBalances.get(item.productId) ?? new Decimal(0);
      const newQty = previousQty.minus(item.quantity);
      movementBalances.set(item.productId, newQty);
      await tx.inventoryMovement.create({ data: { productId: item.productId, invoiceId: invoice.id, userId: input.userId, type: "SALE", quantity: new Decimal(item.quantity).negated().toFixed(4), previousQty: previousQty.toFixed(4), newQty: newQty.toFixed(4), referenceType: "INVOICE", referenceId: invoice.id } });
    }

    const response: IssuedInvoiceResult = { invoiceId: invoice.id, invoiceNumber, grandTotal: totals.grandTotal.toFixed(2) };
    await tx.idempotencyKey.create({ data: { companyId: company.id, key: input.idempotencyKey, command: "ISSUE_INVOICE", entityId: invoice.id, response } });
    await tx.auditLog.create({ data: { companyId: company.id, userId: input.userId, invoiceId: invoice.id, action: "INVOICE_ISSUED", entityType: "Invoice", entityId: invoice.id, newValue: response } });
    await createNotification(tx, company.id, input.userId, { type: "SUCCESS", title: "Invoice issued", message: `${invoiceNumber} was issued for ${totals.grandTotal.toFixed(2)}.`, entityType: "Invoice", entityId: invoice.id, href: "/?view=All%20Invoices" });
    return response;
  });
}

export async function updateDraft(rawInput: unknown, userId: string, companyId: string): Promise<DraftMutationResult> {
  const parsed = draftUpdateSchema.parse(rawInput);
  const { invoiceId, ...draftInput } = parsed;
  const input = { ...draftInput, userId, companyId } as IssueInvoiceInput;
  return db.$transaction(async (tx) => {
    const previousRequest = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key: input.idempotencyKey } } });
    if (previousRequest) return previousRequest.response as DraftMutationResult;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "companyId" = ${companyId} FOR UPDATE`);
    const existing = await tx.invoice.findFirst({ where: { id: invoiceId, companyId, status: "DRAFT" } });
    if (!existing) throw new Error("CONFLICT:Only draft invoices can be edited.");
    const company = await tx.company.findUnique({ where: { id: companyId }, include: { bankAccounts: { where: { active: true }, orderBy: { id: "asc" } } } });
    if (!company) throw new Error("Company was not found.");
    const prepared = await buildInvoiceItemData(tx, input, companyId, input.customerId, company.stateCode);
    const dueDate = calculateDueDate(input.invoiceDate, input.paymentTerms, prepared.customer.creditPeriod, company.defaultTerms);
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { customerId: prepared.customer.id, invoiceDate: input.invoiceDate, dueDate, financialYear: formatFinancialYear(input.invoiceDate), type: input.type, taxMode: prismaTaxMode(prepared.taxMode), deliveryNote: input.deliveryNote, referenceNumber: input.referenceNumber, referenceDate: input.referenceDate, paymentTerms: input.paymentTerms, buyerOrderNumber: input.buyerOrderNumber, buyerOrderDate: input.buyerOrderDate, dispatchDocumentNumber: input.dispatchDocumentNumber, deliveryNoteDate: input.deliveryNoteDate, buyerName: prepared.customer.name, buyerBillingAddress: prepared.customer.billingAddress, buyerDeliveryAddress: prepared.customer.deliveryAddress, buyerGstin: prepared.customer.gstin, buyerState: prepared.customer.state, buyerStateCode: prepared.customer.stateCode, buyerPhone: prepared.customer.phone, dispatchedThrough: input.dispatchedThrough, transporterName: input.transporterName, destination: input.destination, billOfLadingNumber: input.billOfLadingNumber, vehicleNumber: input.vehicleNumber, lrRrNumber: input.lrRrNumber, termsOfDelivery: input.termsOfDelivery, taxableAmount: prepared.totals.taxableValue.toFixed(2), cgstAmount: prepared.totals.cgst.toFixed(2), sgstAmount: prepared.totals.sgst.toFixed(2), igstAmount: prepared.totals.igst.toFixed(2), totalTax: prepared.totals.totalTax.toFixed(2), grandTotal: prepared.totals.grandTotal.toFixed(2), items: { create: prepared.itemData } } });
    await persistTaxMode(tx, updated.id, prepared.taxMode);
    await persistCompanySnapshot(tx, updated.id, snapshotCompany(company, input.bankAccountId));
    const response = { invoiceId: updated.id, grandTotal: prepared.totals.grandTotal.toFixed(2), status: updated.status };
    await tx.idempotencyKey.create({ data: { companyId, key: input.idempotencyKey, command: "UPDATE_DRAFT", entityId: updated.id, response } });
    await tx.auditLog.create({ data: { companyId, userId, invoiceId: updated.id, action: "INVOICE_DRAFT_UPDATED", entityType: "Invoice", entityId: updated.id, previousValue: { grandTotal: existing.grandTotal.toString(), buyerName: existing.buyerName }, newValue: response } });
    await createNotification(tx, companyId, userId, { type: "INFO", title: "Draft updated", message: `Draft for ${prepared.customer.name} was updated.`, entityType: "Invoice", entityId: updated.id, href: "/?view=Create%20Invoice&draftId=" + updated.id });
    return response;
  });
}

export async function deleteDraft(invoiceId: string, userId: string, companyId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} AND "companyId" = ${companyId} FOR UPDATE`);
    const existing = await tx.invoice.findFirst({ where: { id: invoiceId, companyId, status: "DRAFT" }, select: { id: true, buyerName: true, grandTotal: true } });
    if (!existing) throw new Error("CONFLICT:Only draft invoices can be deleted.");
    await tx.auditLog.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
    await tx.invoice.delete({ where: { id: invoiceId } });
    await tx.auditLog.create({ data: { companyId, userId, action: "INVOICE_DRAFT_DELETED", entityType: "Invoice", entityId: invoiceId, previousValue: { buyerName: existing.buyerName, grandTotal: existing.grandTotal.toString() } } });
    await createNotification(tx, companyId, userId, { type: "WARNING", title: "Draft deleted", message: `Draft for ${existing.buyerName} was deleted.`, entityType: "Invoice", entityId: invoiceId, href: "/?view=All%20Invoices" });
    return { invoiceId, status: "DELETED" };
  });
}
