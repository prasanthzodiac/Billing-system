import { mkdir, writeFile } from "node:fs/promises";
import { renderInvoicePdf } from "../lib/server/invoice-pdf";

async function main() {
  const bytes = await renderInvoicePdf({
    invoiceNumber: "VVEL/26-27/0038",
    invoiceDate: new Date("2026-08-15T00:00:00Z"),
    type: "BILL_OF_SUPPLY",
    status: "ISSUED",
    buyerName: "Super Breeding Farm",
    buyerBillingAddress: "No. 1/252, Chithambalam, Udumalpet Road, Palladam, Tiruppur - 641664, Tamil Nadu",
    buyerDeliveryAddress: "Palladam, Tamil Nadu",
    buyerGstin: "33AAWFS4609R1Z9",
    buyerState: "Tamil Nadu",
    buyerStateCode: "33",
    buyerPhone: "+91 98765 43210",
    referenceNumber: "REF/26-27/0045",
    referenceDate: new Date("2026-08-15T00:00:00Z"),
    paymentTerms: "30 Days",
    buyerOrderNumber: "PO/26-27/0098",
    buyerOrderDate: new Date("2026-08-14T00:00:00Z"),
    dispatchDocumentNumber: "DC/26-27/0147",
    deliveryNoteDate: new Date("2026-08-15T00:00:00Z"),
    dispatchedThrough: "DHANALAXMI AGENCIES",
    destination: "PALLADAM",
    billOfLadingNumber: "SR1BALAJILO",
    lrRrNumber: "SR1BALAJILO",
    vehicleNumber: "TN52AF2124",
    termsOfDelivery: "FOR DESTINATION",
    taxableAmount: "988904.96",
    cgstAmount: "0",
    sgstAmount: "0",
    igstAmount: "0",
    totalTax: "0",
    roundOff: "0",
    grandTotal: "988904.96",
    company: {
      name: "Velmayil Ventures",
      addressLine1: "Door No: 165/1/MADATHOTTAM, Street: MADATHOTTAM",
      addressLine2: "Area: GOVINDAPURAM, Village: GOVINDAPURAM, Taluk: DHARAPURAM, Post Office: GOVINDAPURAM",
      city: "Govindapuram",
      district: "Tiruppur",
      state: "Tamil Nadu",
      stateCode: "33",
      pinCode: "638657",
      gstin: "33AABCDE1234F1Z5",
      pan: "AABCDE1234F",
      phone: "+91 95855 28873",
      email: null,
      website: null,
      logoUrl: "/velmayil-ventures-logo-pdf.png",
      defaultJurisdiction: "Tiruppur jurisdiction",
      declaration: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
      authorizedSignatory: "Authorised Signatory"
    },
    companyBankAccounts: [{ bankName: "State Bank of India", accountHolder: "Velmayil Ventures", accountNumber: "62047246610", ifsc: "SBIN0020777", branch: "MSME WARANGAL BRANCH" }],
      items: Array.from({ length: 16 }, (_, index) => ({ serialNumber: index + 1, productName: "Maize", description: "Premium agricultural produce", hsnSac: "10059000", quantity: "22.3125", unit: "QTY", rate: "2770", taxableValue: "61806.56", gstPercent: "0", lineAmount: "61806.56" }))
  });

  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/sample-invoice.pdf", bytes);
  console.log("Wrote output/pdf/sample-invoice.pdf");
}

main();
