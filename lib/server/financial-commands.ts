import "server-only";

import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { isInvoiceOverdue } from "@/lib/financial";
import { runSerializableTransaction } from "@/lib/server/db";
import { buildEwayBillPayload, getEwayBillProvider } from "@/lib/server/eway-bill";
import { createNotification } from "@/lib/server/notifications";
import { cancelInvoiceSchema, ewayBillGenerateSchema, inventoryAdjustmentSchema, paymentReversalSchema, paymentSchema } from "@/lib/server/schemas";

export async function recordPayment(rawInput: unknown, userId: string, companyId: string) {
  const input = paymentSchema.parse(rawInput);
  return runSerializableTransaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key: input.idempotencyKey } } });
    if (previous) return previous.response;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${input.invoiceId} AND "companyId" = ${companyId} FOR UPDATE`);
    const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, companyId }, include: { customer: true } });
    if (!invoice || invoice.status === "CANCELLED" || invoice.status === "DRAFT") throw new Error("CONFLICT:Only issued invoices can receive payments.");
    const amount = new Decimal(input.amount);
    const outstanding = new Decimal(invoice.grandTotal.toString()).minus(invoice.amountPaid.toString());
    if (amount.lte(0) || amount.gt(outstanding)) throw new Error(`BAD_REQUEST:Payment exceeds the invoice outstanding amount of ${outstanding.toFixed(2)}.`);
    const payment = await tx.payment.create({ data: { invoiceId: invoice.id, customerId: invoice.customerId, recordedById: userId, amount: amount.toFixed(2), paymentDate: input.paymentDate, method: input.method, referenceNumber: input.referenceNumber, bank: input.bank, notes: input.notes } });
    const amountPaid = new Decimal(invoice.amountPaid.toString()).plus(amount);
    const status = amountPaid.eq(invoice.grandTotal.toString()) ? "PAID" : isInvoiceOverdue(invoice.dueDate, new Decimal(invoice.grandTotal.toString()).minus(amountPaid)) ? "OVERDUE" : "PARTIALLY_PAID";
    await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: amountPaid.toFixed(2), status } });
    const response = { paymentId: payment.id, invoiceId: invoice.id, amount: amount.toFixed(2), status };
    await tx.idempotencyKey.create({ data: { companyId, key: input.idempotencyKey, command: "RECORD_PAYMENT", entityId: payment.id, response } });
    await tx.auditLog.create({ data: { companyId, userId, invoiceId: invoice.id, action: "PAYMENT_ADDED", entityType: "Payment", entityId: payment.id, newValue: response } });
    await createNotification(tx, companyId, userId, { type: "SUCCESS", title: "Payment recorded", message: `${amount.toFixed(2)} received for ${invoice.invoiceNumber ?? "invoice"}.`, entityType: "Payment", entityId: payment.id, href: "/?view=Payments" });
    return response;
  });
}

export async function cancelInvoice(rawInput: unknown, userId: string, companyId: string) {
  const input = cancelInvoiceSchema.parse(rawInput);
  return runSerializableTransaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key: input.idempotencyKey } } });
    if (previous) return previous.response;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${input.invoiceId} AND "companyId" = ${companyId} FOR UPDATE`);
    const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, companyId }, include: { items: true } });
    if (!invoice || invoice.status === "CANCELLED" || invoice.status === "DRAFT") throw new Error("CONFLICT:Only an issued invoice can be cancelled.");
    if (new Decimal(invoice.amountPaid.toString()).gt(0)) throw new Error("CONFLICT:Invoices with payments require a refund or payment-reversal workflow before cancellation.");
    const balances = new Map<string, Decimal>();
    for (const item of invoice.items) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${item.productId} FOR UPDATE`);
      if (!balances.has(item.productId)) {
        const aggregate = await tx.inventoryMovement.aggregate({ where: { productId: item.productId }, _sum: { quantity: true } });
        balances.set(item.productId, new Decimal(aggregate._sum.quantity?.toString() ?? "0"));
      }
      const previousQty = balances.get(item.productId) ?? new Decimal(0);
      const newQty = previousQty.plus(item.quantity.toString());
      balances.set(item.productId, newQty);
      await tx.inventoryMovement.create({ data: { productId: item.productId, invoiceId: invoice.id, userId, type: "SALE_REVERSAL", quantity: item.quantity.toString(), previousQty: previousQty.toFixed(4), newQty: newQty.toFixed(4), referenceType: "INVOICE_CANCELLATION", referenceId: invoice.id, notes: input.reason } });
    }
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: userId, cancellationReason: input.reason } });
    const response = { invoiceId: invoice.id, status: "CANCELLED" };
    await tx.idempotencyKey.create({ data: { companyId, key: input.idempotencyKey, command: "CANCEL_INVOICE", entityId: invoice.id, response } });
    await tx.auditLog.create({ data: { companyId, userId, invoiceId: invoice.id, action: "INVOICE_CANCELLED", entityType: "Invoice", entityId: invoice.id, newValue: { reason: input.reason } } });
    await createNotification(tx, companyId, userId, { type: "WARNING", title: "Invoice cancelled", message: `${invoice.invoiceNumber ?? "Invoice"} was cancelled and stock was restored.`, entityType: "Invoice", entityId: invoice.id, href: "/?view=All%20Invoices" });
    return response;
  });
}

export async function reversePayment(rawInput: unknown, userId: string, companyId: string) {
  const input = paymentReversalSchema.parse(rawInput);
  return runSerializableTransaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key: input.idempotencyKey } } });
    if (previous) return previous.response;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${input.invoiceId} AND "companyId" = ${companyId} FOR UPDATE`);
    const payment = await tx.payment.findFirst({ where: { id: input.paymentId, invoiceId: input.invoiceId, reversedAt: null }, include: { invoice: true } });
    if (!payment || payment.invoice.companyId !== companyId) throw new Error("CONFLICT:Payment was not found or has already been reversed.");
    const amountPaid = new Decimal(payment.invoice.amountPaid.toString()).minus(payment.amount.toString());
    if (amountPaid.lt(0)) throw new Error("CONFLICT:Payment ledger is inconsistent; reversal was not applied.");
    const outstanding = new Decimal(payment.invoice.grandTotal.toString()).minus(amountPaid);
    const status = amountPaid.isZero() ? (isInvoiceOverdue(payment.invoice.dueDate, outstanding) ? "OVERDUE" : "ISSUED") : amountPaid.eq(payment.invoice.grandTotal.toString()) ? "PAID" : (isInvoiceOverdue(payment.invoice.dueDate, outstanding) ? "OVERDUE" : "PARTIALLY_PAID");
    await tx.payment.update({ where: { id: payment.id }, data: { reversedAt: new Date(), reversedById: userId, reversalReason: input.reason } });
    await tx.invoice.update({ where: { id: payment.invoiceId }, data: { amountPaid: amountPaid.toFixed(2), status } });
    const response = { invoiceId: payment.invoiceId, paymentId: payment.id, reversedAmount: payment.amount.toString(), status };
    await tx.idempotencyKey.create({ data: { companyId, key: input.idempotencyKey, command: "REVERSE_PAYMENT", entityId: payment.id, response } });
    await tx.auditLog.create({ data: { companyId, userId, invoiceId: payment.invoiceId, action: "PAYMENT_REVERSED", entityType: "Payment", entityId: payment.id, previousValue: { amount: payment.amount.toString() }, newValue: { ...response, reason: input.reason } } });
    await createNotification(tx, companyId, userId, { type: "WARNING", title: "Payment reversed", message: `${payment.amount.toString()} was reversed for ${payment.invoice.invoiceNumber ?? "invoice"}.`, entityType: "Payment", entityId: payment.id, href: "/?view=Payments" });
    return response;
  });
}

export async function recordInventoryAdjustment(rawInput: unknown, userId: string, companyId: string) {
  const input = inventoryAdjustmentSchema.parse(rawInput);
  return runSerializableTransaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key: input.idempotencyKey } } });
    if (previous) return previous.response;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${input.productId} AND "companyId" = ${companyId} FOR UPDATE`);
    const product = await tx.product.findFirst({ where: { id: input.productId, companyId, active: true } });
    if (!product) throw new Error("BAD_REQUEST:Product is missing or inactive.");
    const aggregate = await tx.inventoryMovement.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
    const currentQty = new Decimal(aggregate._sum.quantity?.toString() ?? "0");
    const quantity = new Decimal(input.quantity);
    const signedQuantity = input.direction === "IN" ? quantity : quantity.negated();
    const newQty = currentQty.plus(signedQuantity);
    if (newQty.lt(0)) throw new Error(`CONFLICT:${product.name} cannot go below zero stock. Available: ${currentQty.toString()}, requested out: ${quantity.toString()}.`);
    const type = input.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
    const movement = await tx.inventoryMovement.create({ data: { productId: product.id, userId, type, quantity: signedQuantity.toFixed(4), previousQty: currentQty.toFixed(4), newQty: newQty.toFixed(4), referenceType: "MANUAL_ADJUSTMENT", referenceId: product.id, notes: input.notes } });
    const response = { movementId: movement.id, productId: product.id, productName: product.name, quantity: signedQuantity.toFixed(4), newQty: newQty.toFixed(4) };
    await tx.idempotencyKey.create({ data: { companyId, key: input.idempotencyKey, command: "INVENTORY_ADJUSTMENT", entityId: movement.id, response } });
    await tx.auditLog.create({ data: { companyId, userId, action: "STOCK_ADJUSTED", entityType: "InventoryMovement", entityId: movement.id, newValue: response } });
    await createNotification(tx, companyId, userId, { type: input.direction === "IN" ? "SUCCESS" : "WARNING", title: "Inventory adjusted", message: `${product.name}: ${input.direction === "IN" ? "added" : "removed"} ${quantity.toString()} ${product.unit}.`, entityType: "InventoryMovement", entityId: movement.id, href: "/?view=Inventory" });
    return response;
  });
}

export async function generateEwayBill(rawInput: unknown, invoiceId: string, userId: string, companyId: string) {
  const input = ewayBillGenerateSchema.parse(rawInput);
  return runSerializableTransaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key: input.idempotencyKey } } });
    if (previous) return previous.response;
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId }, include: { items: true, company: true } });
    if (!invoice || invoice.status === "DRAFT" || invoice.status === "CANCELLED") throw new Error("CONFLICT:Only an issued invoice can have an e-way bill.");
    if (invoice.ewayBillStatus === "GENERATED") throw new Error("CONFLICT:An e-way bill is already active for this invoice. Cancel it before generating a new one.");
    const payload = buildEwayBillPayload(invoice, input);
    const result = await getEwayBillProvider().generate(payload);
    await tx.invoice.update({ where: { id: invoice.id }, data: { transportMode: input.transportMode, vehicleType: input.vehicleType, transportDistanceKm: input.transportDistanceKm, ewayBillStatus: "GENERATED", ewayBillNumber: result.ewayBillNumber, ewayBillDate: result.ewayBillDate, ewayBillValidUpto: result.validUpto } });
    const response = { invoiceId: invoice.id, ewayBillNumber: result.ewayBillNumber, ewayBillDate: result.ewayBillDate.toISOString(), validUpto: result.validUpto.toISOString() };
    await tx.idempotencyKey.create({ data: { companyId, key: input.idempotencyKey, command: "GENERATE_EWAY_BILL", entityId: invoice.id, response } });
    await tx.auditLog.create({ data: { companyId, userId, invoiceId: invoice.id, action: "EWAY_BILL_GENERATED", entityType: "Invoice", entityId: invoice.id, newValue: response } });
    await createNotification(tx, companyId, userId, { type: "SUCCESS", title: "E-way bill generated", message: `${result.ewayBillNumber} generated for ${invoice.invoiceNumber ?? "invoice"}.`, entityType: "Invoice", entityId: invoice.id, href: "/?view=All%20Invoices" });
    return response;
  });
}
