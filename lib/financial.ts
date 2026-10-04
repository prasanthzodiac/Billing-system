import Decimal from "decimal.js";

export type TaxMode = "INTRA_STATE" | "INTER_STATE" | "NO_GST";

const VALID_INDIAN_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "97"
]);

export function validateIndianStateCode(value: string): string {
  const normalized = String(value ?? "").trim().padStart(2, "0");
  if (!VALID_INDIAN_STATE_CODES.has(normalized)) throw new Error("BAD_REQUEST:Company and customer state codes must be valid Indian GST state codes.");
  return normalized;
}

export function deriveTaxMode(companyStateCode: string, placeOfSupplyStateCode: string): TaxMode {
  return validateIndianStateCode(companyStateCode) === validateIndianStateCode(placeOfSupplyStateCode) ? "INTRA_STATE" : "INTER_STATE";
}

export function resolveTaxMode(companyStateCode: string, placeOfSupplyStateCode: string, requestedMode?: TaxMode): TaxMode {
  const companyState = validateIndianStateCode(companyStateCode);
  const placeOfSupplyState = validateIndianStateCode(placeOfSupplyStateCode);
  if (requestedMode === "NO_GST") return requestedMode;
  const derivedMode = companyState === placeOfSupplyState ? "INTRA_STATE" : "INTER_STATE";
  if (requestedMode && requestedMode !== derivedMode) {
    throw new Error(`BAD_REQUEST:${derivedMode === "INTRA_STATE" ? "CGST / SGST is required for an intra-state supply." : "IGST is required for an inter-state supply."}`);
  }
  return requestedMode ?? derivedMode;
}

export function parseCreditPeriod(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 365) return value;
  const match = String(value ?? "").match(/\d{1,3}/);
  if (!match) return null;
  const days = Number(match[0]);
  return Number.isInteger(days) && days >= 0 && days <= 365 ? days : null;
}

export function resolveCreditPeriod(paymentTerms: string | null | undefined, customerCreditPeriod: number, companyDefaultTerms?: string | null): number {
  return parseCreditPeriod(paymentTerms) ?? parseCreditPeriod(customerCreditPeriod) ?? parseCreditPeriod(companyDefaultTerms) ?? 0;
}

export function calculateDueDate(invoiceDate: Date, paymentTerms: string | null | undefined, customerCreditPeriod: number, companyDefaultTerms?: string | null): Date {
  const dueDate = new Date(invoiceDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + resolveCreditPeriod(paymentTerms, customerCreditPeriod, companyDefaultTerms));
  return dueDate;
}

export function isInvoiceOverdue(dueDate: Date | null | undefined, outstanding: Decimal.Value, now = new Date()): boolean {
  if (!dueDate) return false;
  const currentBusinessDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Decimal(outstanding).gt(0) && dueDate < currentBusinessDate;
}

export function indiaPeriodStarts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value) - 1;
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const start = (startYear: number, startMonth: number, startDay = 1) => new Date(Date.UTC(startYear, startMonth, startDay) - (5 * 60 + 30) * 60 * 1000);
  const fiscalYear = month >= 3 ? year : year - 1;
  const fiscalMonthIndex = (month - 3 + 12) % 12;
  const quarterMonth = (3 + Math.floor(fiscalMonthIndex / 3) * 3) % 12;
  const quarterYear = quarterMonth >= 3 ? fiscalYear : fiscalYear + 1;
  return {
    dayStart: start(year, month, day),
    monthStart: start(year, month),
    quarterStart: start(quarterYear, quarterMonth),
    yearStart: start(fiscalYear, 3)
  };
}

export type InvoiceLineInput = {
  quantity: string;
  rate: string;
  discountPercent?: string;
  gstPercent: string;
};

export type InvoiceLineCalculation = {
  taxableValue: Decimal;
  discountAmount: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  lineAmount: Decimal;
};

const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function calculateLine(input: InvoiceLineInput, mode: TaxMode): InvoiceLineCalculation {
  const quantity = new Decimal(input.quantity);
  const rate = new Decimal(input.rate);
  const discountPercent = new Decimal(input.discountPercent ?? "0");
  const gstPercent = new Decimal(input.gstPercent);

  if (!quantity.isFinite() || quantity.lte(0)) throw new Error("BAD_REQUEST:Quantity must be greater than zero.");
  if (!rate.isFinite() || rate.lt(0)) throw new Error("BAD_REQUEST:Rate must be a non-negative decimal.");
  if (!discountPercent.isFinite() || discountPercent.lt(0) || discountPercent.gt(100)) throw new Error("BAD_REQUEST:Discount must be between 0 and 100.");
  if (!gstPercent.isFinite() || gstPercent.lt(0) || gstPercent.gt(100)) throw new Error("BAD_REQUEST:GST must be between 0 and 100.");

  const gross = quantity.mul(rate);
  const discountAmount = money(gross.mul(discountPercent).div(100));
  const taxableValue = money(gross.minus(discountAmount));
  const totalTax = mode === "NO_GST" ? new Decimal(0) : money(taxableValue.mul(gstPercent).div(100));
  const cgst = mode === "INTRA_STATE" ? money(totalTax.div(2)) : new Decimal(0);
  const sgst = mode === "INTRA_STATE" ? money(totalTax.minus(cgst)) : new Decimal(0);
  const igst = mode === "INTER_STATE" ? totalTax : new Decimal(0);

  return { taxableValue, discountAmount, cgst, sgst, igst, lineAmount: money(taxableValue.plus(totalTax)) };
}

export function calculateInvoice(lines: InvoiceLineCalculation[]) {
  const taxableValue = money(lines.reduce((sum, line) => sum.plus(line.taxableValue), new Decimal(0)));
  const cgst = money(lines.reduce((sum, line) => sum.plus(line.cgst), new Decimal(0)));
  const sgst = money(lines.reduce((sum, line) => sum.plus(line.sgst), new Decimal(0)));
  const igst = money(lines.reduce((sum, line) => sum.plus(line.igst), new Decimal(0)));
  const grandTotal = money(taxableValue.plus(cgst).plus(sgst).plus(igst));
  return { taxableValue, cgst, sgst, igst, totalTax: money(cgst.plus(sgst).plus(igst)), grandTotal };
}

export function formatFinancialYear(date: Date): string {
  const year = date.getUTCFullYear();
  const startsInApril = date.getUTCMonth() >= 3;
  const start = startsInApril ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

export function formatInvoiceNumber(prefix: string, financialYear: string, sequence: number): string {
  if (!/^[A-Z0-9-]+$/.test(prefix)) throw new Error("Invoice prefix contains invalid characters.");
  if (!/^\d{2}-\d{2}$/.test(financialYear)) throw new Error("Financial year must use YY-YY format.");
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Sequence must be a positive integer.");
  return `${prefix}/${financialYear}/${sequence}`;
}

const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underThousand(value: number): string {
  if (value < 20) return ones[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
  return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${underThousand(value % 100)}` : ""}`;
}

function indianIntegerWords(value: number): string {
  if (value === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(value / 10000000); value %= 10000000;
  const lakh = Math.floor(value / 100000); value %= 100000;
  const thousand = Math.floor(value / 1000); value %= 1000;
  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (value) parts.push(underThousand(value));
  return parts.join(" ");
}

export function amountToWordsIndian(value: Decimal.Value): string {
  const amount = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const rupees = amount.floor().toNumber();
  const paise = amount.minus(rupees).mul(100).toNumber();
  return `INR ${indianIntegerWords(rupees)}${paise ? ` and ${underThousand(paise)} Paise` : ""} Only`;
}
