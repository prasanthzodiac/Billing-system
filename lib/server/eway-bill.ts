import "server-only";

import type { Invoice, InvoiceItem, TransportMode, VehicleType } from "@prisma/client";

import { getEnv } from "@/lib/server/env";

const transportModeCode: Record<TransportMode, string> = { ROAD: "1", RAIL: "2", AIR: "3", SHIP: "4" };
const docTypeCode: Record<string, string> = { TAX_INVOICE: "INV", BILL_OF_SUPPLY: "BIL" };

function nicDate(value: Date) {
  return [String(value.getUTCDate()).padStart(2, "0"), String(value.getUTCMonth() + 1).padStart(2, "0"), value.getUTCFullYear()].join("/");
}

type EwayBillInvoice = Invoice & {
  items: InvoiceItem[];
  company: { name: string; gstin: string | null; addressLine1: string; addressLine2: string | null; city: string; pinCode: string; stateCode: string };
};

export type EwayBillPayload = ReturnType<typeof buildEwayBillPayload>;

/**
 * Builds the standard NIC e-way bill JSON shape. Every GSP (ClearTax, Vayana,
 * Cygnet, MasterGST, ...) wraps this same schema, so this builder stays valid
 * regardless of which GSP the generate() call below ends up targeting.
 */
export function buildEwayBillPayload(invoice: EwayBillInvoice, extra: { transportDistanceKm: number; transportMode: TransportMode; vehicleType: VehicleType }) {
  if (!invoice.invoiceNumber) throw new Error("BAD_REQUEST:Invoice must be issued before an e-way bill can be generated.");
  return {
    supplyType: "O",
    subSupplyType: "1",
    docType: docTypeCode[invoice.type] ?? "OTH",
    docNo: invoice.invoiceNumber,
    docDate: nicDate(invoice.invoiceDate),
    fromGstin: invoice.company.gstin ?? "URP",
    fromTrdName: invoice.company.name,
    fromAddr1: invoice.company.addressLine1,
    fromAddr2: invoice.company.addressLine2 ?? "",
    fromPlace: invoice.company.city,
    fromPincode: Number(invoice.company.pinCode),
    fromStateCode: Number(invoice.company.stateCode),
    toGstin: invoice.buyerGstin ?? "URP",
    toTrdName: invoice.buyerName,
    toAddr1: invoice.buyerBillingAddress,
    toAddr2: "",
    toPlace: invoice.buyerState,
    toPincode: undefined,
    toStateCode: Number(invoice.buyerStateCode),
    itemList: invoice.items.map((item) => ({
      productName: item.productName,
      productDesc: item.description ?? item.productName,
      hsnCode: item.hsnSac,
      quantity: Number(item.quantity),
      qtyUnit: item.unit,
      taxableAmount: Number(item.taxableValue),
      sgstRate: Number(item.sgstAmount) > 0 ? Number(item.gstPercent) / 2 : 0,
      cgstRate: Number(item.cgstAmount) > 0 ? Number(item.gstPercent) / 2 : 0,
      igstRate: Number(item.igstAmount) > 0 ? Number(item.gstPercent) : 0
    })),
    totalValue: Number(invoice.taxableAmount),
    cgstValue: Number(invoice.cgstAmount),
    sgstValue: Number(invoice.sgstAmount),
    igstValue: Number(invoice.igstAmount),
    totInvValue: Number(invoice.grandTotal),
    transporterName: invoice.transporterName ?? undefined,
    transDocNo: invoice.dispatchDocumentNumber ?? undefined,
    vehicleNo: invoice.vehicleNumber ?? undefined,
    vehicleType: extra.vehicleType === "OVER_DIMENSIONAL_CARGO" ? "O" : "R",
    transMode: transportModeCode[extra.transportMode],
    transDistance: extra.transportDistanceKm
  };
}

export type EwayBillGenerateResult = { ewayBillNumber: string; ewayBillDate: Date; validUpto: Date };

export interface EwayBillProvider {
  generate(payload: EwayBillPayload): Promise<EwayBillGenerateResult>;
  cancel(ewayBillNumber: string, reason: string): Promise<void>;
}

/**
 * No GSP is wired up yet (chosen at integration time, not now). This throws a
 * clear, user-facing error instead of guessing at an API shape we don't have
 * real credentials or docs for. Swap in a real EwayBillProvider implementation
 * here once a GSP contract exists.
 */
export function getEwayBillProvider(): EwayBillProvider {
  const env = getEnv();
  if (!env.EWAYBILL_PROVIDER || !env.EWAYBILL_API_BASE_URL || !env.EWAYBILL_API_KEY) {
    throw new Error("BAD_REQUEST:E-way bill provider is not configured. Set EWAYBILL_PROVIDER, EWAYBILL_API_BASE_URL, EWAYBILL_API_KEY, EWAYBILL_API_SECRET, and EWAYBILL_GSTIN once a GST Suvidha Provider is chosen.");
  }
  throw new Error(`BAD_REQUEST:No e-way bill adapter implemented for provider "${env.EWAYBILL_PROVIDER}" yet.`);
}
