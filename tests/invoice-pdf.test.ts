import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { amountToWordsIndian } from "@/lib/financial";
import { renderInvoicePdf } from "@/lib/server/invoice-pdf";

const sampleInvoice = {
  invoiceNumber: "DBEP/26-27/341", invoiceDate: new Date("2026-08-15T00:00:00Z"), type: "BILL_OF_SUPPLY", status: "ISSUED", buyerName: "Bharat Mills & Agro Pvt. Ltd.", buyerBillingAddress: "Plot 18, Industrial Area, Hubballi", buyerDeliveryAddress: "Same as billing", buyerGstin: "29AABCB1234G1Z5", buyerState: "Karnataka", buyerStateCode: "29", buyerPhone: null, destination: "Hubballi, Karnataka", vehicleNumber: "KA 25 AB 1234", lrRrNumber: "LR-2026-0881", termsOfDelivery: "FOR destination", paymentTerms: "30 days", taxableAmount: "988890", cgstAmount: "0", sgstAmount: "0", igstAmount: "0", totalTax: "0", roundOff: "0", grandTotal: "988890", company: { name: "DB Enterprises", addressLine1: "18 Industrial Area", addressLine2: null, city: "Hubballi", district: "Dharwad", state: "Karnataka", stateCode: "29", pinCode: "580001", gstin: "29AAAAA0000A1Z5", pan: "AAAAA0000A", phone: null, email: null, declaration: null, authorizedSignatory: "Authorized Signatory" }, companyBankAccounts: [{ bankName: "State Bank of India", accountHolder: "DB Enterprises", accountNumber: "1234567890", ifsc: "SBIN0000001", branch: "Hubballi" }], items: Array.from({ length: 40 }, (_, index) => ({ serialNumber: index + 1, productName: `Industrial product ${index + 1}`, description: "Long description used to verify wrapping and repeated table headers.", hsnSac: "10059000", quantity: "10", unit: "QTY", rate: "100", taxableValue: "1000", gstPercent: "0", lineAmount: "1000" }))
};

describe("invoice PDF", () => {
  it("writes Indian amount wording", () => {
    expect(amountToWordsIndian("988890")).toBe("INR Nine Lakh Eighty Eight Thousand Eight Hundred Ninety Only");
  });

  it("renders a valid multi-page PDF with repeated table structure", async () => {
    const bytes = await renderInvoicePdf(sampleInvoice);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(bytes.slice(0, 4).toString()).toBe("37,80,68,70");
  });
});

