import { z } from "zod";

const indianStateCodes = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "97"]);
const stateCode = z.string().trim().regex(/^\d{2}$/, "State code must contain two digits.").refine((value) => indianStateCodes.has(value), "State code must be a valid Indian GST state code.");
const gstin = z.string().trim().toUpperCase().regex(/^\d{2}[A-Z0-9]{13}$/, "GSTIN must contain 15 valid characters.");
const pan = z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "PAN must use the standard 10-character format.");
const ifsc = z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC must use the standard 11-character format.");

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string.");

export const issueInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceDate: z.coerce.date(),
  type: z.enum(["BILL_OF_SUPPLY", "TAX_INVOICE"]),
  // The server validates this selection against stored state codes; NO_GST is always allowed.
  taxMode: z.enum(["INTRA_STATE", "INTER_STATE", "NO_GST"]).optional(),
  bankAccountId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  deliveryNote: z.string().trim().max(120).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  referenceDate: z.coerce.date().optional(),
  paymentTerms: z.string().trim().max(120).optional(),
  buyerOrderNumber: z.string().trim().max(120).optional(),
  buyerOrderDate: z.coerce.date().optional(),
  dispatchDocumentNumber: z.string().trim().max(120).optional(),
  deliveryNoteDate: z.coerce.date().optional(),
  dispatchedThrough: z.string().trim().max(160).optional(),
  transporterName: z.string().trim().max(160).optional(),
  destination: z.string().trim().max(120).optional(),
  billOfLadingNumber: z.string().trim().max(120).optional(),
  vehicleNumber: z.string().trim().max(30).optional(),
  lrRrNumber: z.string().trim().max(80).optional(),
  termsOfDelivery: z.string().trim().max(120).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: decimalString,
    rate: decimalString,
    discountPercent: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).default("0"),
    gstPercent: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).default("0")
  })).min(1).max(200)
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;

export const draftUpdateSchema = issueInvoiceSchema.omit({ companyId: true, userId: true }).extend({ invoiceId: z.string().uuid() });
export type DraftUpdateInput = z.infer<typeof draftUpdateSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(160), contactPerson: z.string().trim().max(120).optional(), billingAddress: z.string().trim().min(3).max(500), deliveryAddress: z.string().trim().max(500).optional(), city: z.string().trim().min(2).max(100), district: z.string().trim().max(100).optional(), state: z.string().trim().min(2).max(100), stateCode, pinCode: z.string().trim().regex(/^\d{6}$/).optional(), gstin: gstin.optional(), pan: pan.optional(), phone: z.string().trim().regex(/^\+?[0-9 -]{8,20}$/).optional(), alternatePhone: z.string().trim().regex(/^\+?[0-9 -]{8,20}$/).optional(), email: z.string().trim().email().max(254).optional(), creditLimit: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).default("0"), creditPeriod: z.number().int().min(0).max(365).default(0), openingBalance: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).default("0"), notes: z.string().trim().max(2000).optional(), active: z.boolean().default(true)
}).superRefine((value, ctx) => { if (value.gstin && value.gstin.slice(0, 2) !== value.stateCode) ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN state code must match the customer state code." }); });

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).optional(), sku: z.string().trim().max(80).optional(), hsnSac: z.string().trim().regex(/^[0-9A-Z-]{4,20}$/).transform((value) => value.toUpperCase()), unit: z.string().trim().min(1).max(20), defaultRate: z.string().trim().regex(/^\d+(\.\d{1,4})?$/), purchaseRate: z.string().trim().regex(/^\d+(\.\d{1,4})?$/).default("0"), gstRate: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).default("0"), openingStock: z.string().trim().regex(/^\d+(\.\d{1,4})?$/).default("0"), minimumStock: z.string().trim().regex(/^\d+(\.\d{1,4})?$/).default("0"), active: z.boolean().default(true)
});

export const transporterSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().regex(/^\+?[0-9 -]{8,20}$/).optional(),
  gstin: gstin.optional(),
  address: z.string().trim().max(500).optional(),
  active: z.boolean().default(true)
});

const uniqueUuidList = z.array(z.string().uuid()).min(1).max(8).refine((values) => new Set(values).size === values.length, "Roles must be unique.");
export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  roleIds: uniqueUuidList
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  roleIds: uniqueUuidList
});

export const paymentSchema = z.object({
  invoiceId: z.string().uuid(), amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/), paymentDate: z.coerce.date(), method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "CREDIT", "OTHER"]), referenceNumber: z.string().trim().max(120).optional(), bank: z.string().trim().max(120).optional(), notes: z.string().trim().max(1000).optional(), idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/)
});

export const paymentReversalSchema = z.object({ invoiceId: z.string().uuid(), paymentId: z.string().uuid(), reason: z.string().trim().min(10).max(500), idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/) });

export const inventoryAdjustmentSchema = z.object({ productId: z.string().uuid(), direction: z.enum(["IN", "OUT"]), quantity: decimalString, notes: z.string().trim().min(3).max(500), idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/) });

export const cancelInvoiceSchema = z.object({ invoiceId: z.string().uuid(), reason: z.string().trim().min(10).max(500), idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/) });

export const ewayBillGenerateSchema = z.object({ transportDistanceKm: z.number().int().min(1).max(4000), transportMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]), vehicleType: z.enum(["REGULAR", "OVER_DIMENSIONAL_CARGO"]), idempotencyKey: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/) });

const optionalText = (max: number) => z.string().trim().max(max).optional();
export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(160),
  accountHolder: z.string().trim().min(2).max(160),
  accountNumber: z.string().trim().min(4).max(40),
  ifsc,
  branch: optionalText(160),
  accountType: optionalText(40)
});
export const companySettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  addressLine1: z.string().trim().min(3).max(250),
  addressLine2: optionalText(250),
  city: z.string().trim().min(2).max(100),
  district: optionalText(100),
  state: z.string().trim().min(2).max(100),
  stateCode,
  pinCode: z.string().trim().regex(/^\d{6}$/),
  gstin: gstin.optional(),
  pan: pan.optional(),
  phone: optionalText(30),
  email: z.string().trim().email().max(254).optional(),
  website: optionalText(200),
  logoUrl: optionalText(300),
  defaultJurisdiction: optionalText(120),
  invoicePrefix: z.string().trim().min(2).max(20).regex(/^[A-Z0-9-]+$/, "Invoice prefix may contain only uppercase letters, numbers, and hyphens."),
  defaultTerms: optionalText(500),
  declaration: optionalText(1000),
  authorizedSignatory: optionalText(160),
  bankAccount: bankAccountSchema.optional()
}).superRefine((value, ctx) => { if (value.gstin && value.gstin.slice(0, 2) !== value.stateCode) ctx.addIssue({ code: "custom", path: ["gstin"], message: "GSTIN state code must match the company state code." }); });
