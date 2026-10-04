import { describe, expect, it } from "vitest";

import { calculateDueDate, calculateInvoice, calculateLine, deriveTaxMode, formatFinancialYear, formatInvoiceNumber, indiaPeriodStarts, isInvoiceOverdue, resolveTaxMode } from "@/lib/financial";

describe("financial calculations", () => {
  it("calculates a zero-tax bill of supply without floating point drift", () => {
    const line = calculateLine({ quantity: "357", rate: "2770", gstPercent: "0" }, "INTRA_STATE");
    const totals = calculateInvoice([line]);
    expect(totals.grandTotal.toFixed(2)).toBe("988890.00");
    expect(totals.totalTax.toFixed(2)).toBe("0.00");
  });

  it("splits intra-state GST into CGST and SGST", () => {
    const line = calculateLine({ quantity: "10", rate: "100", gstPercent: "18" }, "INTRA_STATE");
    expect(line.cgst.toFixed(2)).toBe("90.00");
    expect(line.sgst.toFixed(2)).toBe("90.00");
    expect(line.igst.toFixed(2)).toBe("0.00");
  });

  it("uses IGST for inter-state sales", () => {
    const line = calculateLine({ quantity: "10", rate: "100", gstPercent: "18" }, "INTER_STATE");
    expect(line.cgst.toFixed(2)).toBe("0.00");
    expect(line.sgst.toFixed(2)).toBe("0.00");
    expect(line.igst.toFixed(2)).toBe("180.00");
  });

  it("supports an explicit no-GST treatment", () => {
    const line = calculateLine({ quantity: "10", rate: "100", gstPercent: "18" }, "NO_GST");
    expect(line.cgst.toFixed(2)).toBe("0.00");
    expect(line.sgst.toFixed(2)).toBe("0.00");
    expect(line.igst.toFixed(2)).toBe("0.00");
    expect(line.lineAmount.toFixed(2)).toBe("1000.00");
  });

  it("uses the Indian financial year boundary", () => {
    expect(formatFinancialYear(new Date("2026-03-31T00:00:00Z"))).toBe("25-26");
    expect(formatFinancialYear(new Date("2026-04-01T00:00:00Z"))).toBe("26-27");
  });

  it("uses the Indian financial year and quarter boundaries for dashboard periods", () => {
    const april = indiaPeriodStarts(new Date("2026-04-01T06:00:00Z"));
    expect(april.yearStart.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(april.quarterStart.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    const january = indiaPeriodStarts(new Date("2027-01-15T06:00:00Z"));
    expect(january.yearStart.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(january.quarterStart.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("formats safe invoice numbers", () => {
    expect(formatInvoiceNumber("DBEP", "26-27", 341)).toBe("DBEP/26-27/341");
    expect(() => formatInvoiceNumber("dbep", "26-27", 341)).toThrow();
  });

  it("derives tax mode from authoritative state codes", () => {
    expect(deriveTaxMode("29", "29")).toBe("INTRA_STATE");
    expect(deriveTaxMode("29", "33")).toBe("INTER_STATE");
    expect(() => deriveTaxMode("00", "29")).toThrow();
  });

  it("accepts no GST and rejects a tax mode that conflicts with place of supply", () => {
    expect(resolveTaxMode("29", "29", "NO_GST")).toBe("NO_GST");
    expect(resolveTaxMode("29", "33", "INTER_STATE")).toBe("INTER_STATE");
    expect(() => resolveTaxMode("29", "33", "INTRA_STATE")).toThrow();
    expect(() => resolveTaxMode("00", "33", "NO_GST")).toThrow();
  });

  it("calculates due dates from invoice terms before customer defaults", () => {
    const invoiceDate = new Date("2026-08-17T00:00:00Z");
    expect(calculateDueDate(invoiceDate, "30 days", 15).toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(calculateDueDate(invoiceDate, undefined, 15).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("does not mark an invoice overdue on its due date", () => {
    const dueDate = new Date("2026-08-17T00:00:00Z");
    expect(isInvoiceOverdue(dueDate, "100", new Date("2026-08-17T12:00:00Z"))).toBe(false);
    expect(isInvoiceOverdue(dueDate, "100", new Date("2026-08-18T00:00:00Z"))).toBe(true);
    expect(isInvoiceOverdue(dueDate, "0", new Date("2026-08-18T00:00:00Z"))).toBe(false);
  });
});
