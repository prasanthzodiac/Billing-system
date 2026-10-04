import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { amountToWordsIndian } from "@/lib/financial";

type PdfInvoice = {
  invoiceNumber: string | null; invoiceDate: Date; type: string; status: string; buyerName: string; buyerBillingAddress: string; buyerDeliveryAddress: string | null; buyerGstin: string | null; buyerState: string; buyerStateCode: string; buyerPhone: string | null;
  deliveryNote?: string | null; paymentTerms: string | null; referenceNumber?: string | null; referenceDate?: Date | null; buyerOrderNumber?: string | null; buyerOrderDate?: Date | null; dispatchDocumentNumber?: string | null; deliveryNoteDate?: Date | null; dispatchedThrough?: string | null; transporterName?: string | null; destination: string | null; billOfLadingNumber?: string | null; lrRrNumber: string | null; vehicleNumber: string | null; termsOfDelivery: string | null;
  taxableAmount: unknown; cgstAmount: unknown; sgstAmount: unknown; igstAmount: unknown; totalTax: unknown; roundOff: unknown; grandTotal: unknown;
  company: { name: string; addressLine1: string; addressLine2: string | null; city: string; district: string | null; state: string; stateCode: string; pinCode: string; gstin: string | null; pan: string | null; phone: string | null; email: string | null; website?: string | null; logoUrl?: string | null; defaultJurisdiction?: string | null; declaration: string | null; authorizedSignatory: string | null };
  items: Array<{ serialNumber: number; productName: string; description: string | null; hsnSac: string; quantity: unknown; unit: string; rate: unknown; taxableValue: unknown; gstPercent: unknown; lineAmount: unknown }>;
  companyBankAccounts: Array<{ bankName: string; accountHolder: string; accountNumber: string; ifsc: string; branch: string | null }>;
};

const navy = rgb(0.05, 0.23, 0.40);
const purple = rgb(0.43, 0.23, 0.62);
const gold = rgb(0.77, 0.64, 0.18);
const magenta = rgb(0.69, 0.23, 0.56);
const ink = rgb(0.08, 0.16, 0.23);
const muted = rgb(0.35, 0.42, 0.49);
const line = rgb(0.78, 0.82, 0.85);
const pale = rgb(0.97, 0.98, 0.99);
const white = rgb(1, 1, 1);

function placeholder(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function currency(value: unknown) {
  const amount = Number(value ?? 0);
  return "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

function quantity(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return placeholder(value);
  return amount.toFixed(3).replace(/\.?(0+)$/, "");
}

function dateValue(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value) : "—";
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

function drawRight(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y, size, font, color });
}

function drawCenter(page: PDFPage, text: string, centerX: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(text, { x: centerX - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
}

async function embedImage(pdf: PDFDocument, url: string | null | undefined, fallback: string) {
  const publicRoot = path.resolve(process.cwd(), "public");
  const candidates = [url, fallback].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    const relativePath = candidate.replace(/^[/\\]+/, "");
    if (!relativePath || relativePath.includes("\0")) continue;
    const file = path.resolve(publicRoot, relativePath);
    if (file !== publicRoot && !file.startsWith(publicRoot + path.sep)) continue;
    try { return await pdf.embedPng(await readFile(file)); } catch { /* try the safe fallback */ }
  }
  return null;
}

async function embedCurrencyFont(pdf: PDFDocument) {
  try {
    const file = path.join(process.cwd(), "node_modules", "next", "dist", "compiled", "@vercel", "og", "Geist-Regular.ttf");
    return await pdf.embedFont(await readFile(file));
  } catch {
    return pdf.embedFont(StandardFonts.Helvetica);
  }
}

export async function renderInvoicePdf(invoice: PdfInvoice) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    currency: await embedCurrencyFont(pdf)
  };
  const logo = await embedImage(pdf, invoice.company.logoUrl, "velmayil-ventures-logo-pdf.png");
  const watermark = await embedImage(pdf, "/velmayil-ventures-watermark.png", "velmayil-ventures-watermark.png");
  let page = pdf.addPage([595.28, 841.89]);
  const margin = 28;
  const rightEdge = 567;
  const footerLineY = 210;
  const tableBottomReserve = footerLineY + 146;
  let y = 813;
  let pageNumber = 1;

  const drawWatermark = () => {
    if (!watermark) return;
    // Draw before foreground content so the supplied white-background mark stays print-safe.
    page.drawImage(watermark, { x: 205, y: 300, width: 185, height: 208, opacity: 0.36 });
  };

  const drawHeader = (continued = false) => {
    drawWatermark();
    const logoWidth = 150;
    const logoHeight = logoWidth * (108 / 264);
    if (logo) page.drawImage(logo, { x: margin, y: 770, width: logoWidth, height: logoHeight });

    const companyWidth = 272;
    const companyLines: Array<{ text: string; strong?: boolean; muted?: boolean }> = [];
    const addCompanyLines = (text: string | null | undefined, options: { strong?: boolean; muted?: boolean; size?: number } = {}) => {
      if (!text) return;
      wrap(text, fonts.regular, options.size ?? 7, companyWidth).slice(0, 2).forEach((lineText) => companyLines.push({ text: lineText, strong: options.strong, muted: options.muted }));
    };
    addCompanyLines(invoice.company.addressLine1, { size: 7 });
    addCompanyLines(invoice.company.addressLine2, { size: 7 });
    addCompanyLines([invoice.company.city, invoice.company.district, invoice.company.state, invoice.company.pinCode].filter(Boolean).join(", "), { size: 7 });
    addCompanyLines([invoice.company.phone, invoice.company.email].filter(Boolean).join("  |  "), { muted: true, size: 7 });
    addCompanyLines(invoice.company.website, { muted: true, size: 7 });
    addCompanyLines(invoice.company.gstin ? "GSTIN  : " + invoice.company.gstin : null, { strong: true, size: 7 });
    addCompanyLines(invoice.company.pan ? "PAN     : " + invoice.company.pan : null, { strong: true, size: 7 });
    companyLines.forEach((lineText, index) => page.drawText(lineText.text, { x: margin, y: 758 - index * 7.6, size: 7, font: lineText.strong ? fonts.bold : fonts.regular, color: lineText.strong ? navy : lineText.muted ? muted : ink }));

    drawRight(page, continued ? "BILL - CONTINUED" : "BILL", rightEdge, 800, 15.5, fonts.bold, navy);
    const isDraft = invoice.status.toUpperCase() === "DRAFT" || !invoice.invoiceNumber;
    if (isDraft) {
      page.drawRectangle({ x: 490, y: 776, width: 77, height: 14, color: gold, opacity: 0.16, borderColor: gold, borderWidth: 0.45 });
      drawCenter(page, "DRAFT", 528.5, 780, 7, fonts.bold, navy);
    }
    const meta = [["Invoice No.", placeholder(invoice.invoiceNumber)], ["Invoice Date", dateValue(invoice.invoiceDate)], ["Mode / Terms", placeholder(invoice.paymentTerms)]];
    meta.forEach(([label, value], index) => {
      const rowY = 753 - index * 14;
      page.drawText(label, { x: 388, y: rowY, size: 7.3, font: fonts.regular, color: muted });
      page.drawText(":", { x: 458, y: rowY, size: 7.3, font: fonts.regular, color: muted });
      page.drawText(value, { x: 466, y: rowY, size: 7.3, font: fonts.bold, color: ink });
    });
    page.drawLine({ start: { x: margin, y: 682 }, end: { x: rightEdge, y: 682 }, thickness: 1.15, color: gold });
    y = continued ? 660 : 676;
  };

  const drawItemsHeader = () => {
    page.drawRectangle({ x: margin, y: y - 24, width: rightEdge - margin, height: 24, color: navy });
    drawCenter(page, "Sl. No.", 43, y - 15, 6.6, fonts.bold, white);
    page.drawText("Description of Goods", { x: 63, y: y - 15, size: 6.6, font: fonts.bold, color: white });
    drawCenter(page, "HSN/SAC", 316, y - 15, 6.6, fonts.bold, white);
    drawRight(page, "Quantity", 401, y - 15, 6.6, fonts.bold, white);
    drawRight(page, "Rate", 473, y - 15, 6.6, fonts.bold, white);
    drawCenter(page, "Per", 493, y - 15, 6.6, fonts.bold, white);
    drawRight(page, "Amount", rightEdge - 9, y - 15, 6.6, fonts.bold, white);
    y -= 24;
  };

  drawHeader();
  const detailsTop = 672;
  const detailsBottom = 548;
  page.drawRectangle({ x: margin, y: detailsBottom, width: rightEdge - margin, height: detailsTop - detailsBottom, color: pale, borderColor: line, borderWidth: 0.6 });
  page.drawLine({ start: { x: 302, y: detailsBottom }, end: { x: 302, y: detailsTop }, thickness: 0.5, color: line });
  page.drawText("BILL TO", { x: 38, y: 656, size: 8.2, font: fonts.bold, color: purple });
  page.drawText(placeholder(invoice.buyerName), { x: 38, y: 642, size: 9.5, font: fonts.bold, color: ink });
  wrap(placeholder(invoice.buyerBillingAddress), fonts.regular, 7.4, 244).slice(0, 3).forEach((lineText, index) => page.drawText(lineText, { x: 38, y: 631 - index * 9, size: 7.4, font: fonts.regular, color: ink }));
  const buyerFields: Array<[string, string]> = [["GSTIN / UIN", placeholder(invoice.buyerGstin)], ["State", placeholder(invoice.buyerState)], ["State Code", placeholder(invoice.buyerStateCode)], ["Contact No.", placeholder(invoice.buyerPhone)]];
  buyerFields.forEach(([label, value], index) => {
    const rowY = 598 - index * 11;
    page.drawText(label, { x: 38, y: rowY, size: 7, font: fonts.regular, color: muted });
    page.drawText(":", { x: 105, y: rowY, size: 7, font: fonts.regular, color: muted });
    page.drawText(value, { x: 112, y: rowY, size: 7, font: fonts.regular, color: ink });
  });

  page.drawText("OTHER DETAILS", { x: 318, y: 656, size: 8.2, font: fonts.bold, color: magenta });
  const other: Array<[string, string]> = [
    ["Reference No. & Date", [placeholder(invoice.referenceNumber), dateValue(invoice.referenceDate)].filter((value) => value !== "—").join(" | ") || "—"],
    ["Buyer's Order No.", placeholder(invoice.buyerOrderNumber)], ["Order Date", dateValue(invoice.buyerOrderDate)],
    ["Dispatch Doc No.", placeholder(invoice.dispatchDocumentNumber)], ["Delivery Note Date", dateValue(invoice.deliveryNoteDate)],
    ["Dispatched Through", placeholder(invoice.dispatchedThrough ?? invoice.transporterName)], ["Destination", placeholder(invoice.destination)],
    ["Bill of Lading/LR-RR", [placeholder(invoice.billOfLadingNumber), placeholder(invoice.lrRrNumber)].filter((value) => value !== "—").join(" / ") || "—"],
    ["Motor Vehicle No.", placeholder(invoice.vehicleNumber)], ["Terms of Delivery", placeholder(invoice.termsOfDelivery)]
  ];
  other.forEach(([label, value], index) => {
    const rowY = 640 - index * 9.5;
    page.drawText(label + " :", { x: 318, y: rowY, size: 6.6, font: fonts.regular, color: muted });
    wrap(value, fonts.regular, 6.6, 146).slice(0, 2).forEach((lineText, lineIndex) => page.drawText(lineText, { x: 410, y: rowY - lineIndex * 7.2, size: 6.6, font: fonts.regular, color: ink }));
  });

  y = 524;
  drawItemsHeader();
  const firstPageItemLimit = invoice.items.length > 5 ? Math.min(10, Math.ceil(invoice.items.length / 2)) : Number.POSITIVE_INFINITY;
  for (let itemIndex = 0; itemIndex < invoice.items.length; itemIndex += 1) {
    const item = invoice.items[itemIndex];
    const description = placeholder(item.productName) + (item.description ? " - " + item.description : "");
    const lines = wrap(description, fonts.regular, 7.4, 195);
    const rowHeight = Math.max(25, lines.length * 9 + 9);
    if ((pageNumber === 1 && itemIndex === firstPageItemLimit) || y - rowHeight < (pageNumber === 1 && invoice.items.length > 5 ? 245 : tableBottomReserve)) {
      page = pdf.addPage([595.28, 841.89]);
      pageNumber += 1;
      drawHeader(true);
      y = 660;
      drawItemsHeader();
    }
    drawCenter(page, String(item.serialNumber), 43, y - 16, 7.4, fonts.regular, ink);
    lines.forEach((lineText, index) => page.drawText(lineText, { x: 63, y: y - 16 - index * 9, size: 7.4, font: index === 0 ? fonts.bold : fonts.regular, color: ink }));
    drawCenter(page, placeholder(item.hsnSac), 316, y - 16, 7.3, fonts.regular, ink);
    drawRight(page, quantity(item.quantity), 401, y - 16, 7.3, fonts.regular, ink);
    drawRight(page, currency(item.rate), 473, y - 16, 7.3, fonts.currency, ink);
    drawCenter(page, placeholder(item.unit), 493, y - 16, 7.3, fonts.regular, ink);
    drawRight(page, currency(item.lineAmount), rightEdge - 9, y - 16, 7.3, fonts.currency, ink);
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: rightEdge, y: y - rowHeight }, thickness: 0.35, color: line });
    y -= rowHeight;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: rightEdge, y }, thickness: 0.8, color: navy });
  page.drawText("Total", { x: 283, y: y - 16, size: 8.3, font: fonts.bold, color: navy });
  drawRight(page, quantity(invoice.items.reduce((sum, item) => sum + Number(item.quantity), 0)), 401, y - 16, 7.5, fonts.bold, ink);
  drawRight(page, currency(invoice.grandTotal), rightEdge - 9, y - 16, 7.5, fonts.currency, ink);

  const summaryY = y - 40;
  page.drawText("Amount Chargeable (in words)", { x: margin, y: summaryY, size: 7.5, font: fonts.bold, color: purple });
  const amountWordLines = wrap(amountToWordsIndian(String(invoice.grandTotal ?? 0)), fonts.regular, 7.5, 302).slice(0, 3);
  amountWordLines.forEach((lineText, index) => page.drawText(lineText, { x: margin, y: summaryY - 13 - index * 9, size: 7.5, font: fonts.regular, color: ink }));
  const taxLabelY = summaryY - 15 - amountWordLines.length * 9;
  page.drawText("Tax Amount (in words)", { x: margin, y: taxLabelY, size: 7.5, font: fonts.bold, color: purple });
  const taxWordLines = wrap(Number(invoice.totalTax ?? 0) ? amountToWordsIndian(String(invoice.totalTax)) : "NIL", fonts.regular, 7.5, 302).slice(0, 2);
  taxWordLines.forEach((lineText, index) => page.drawText(lineText, { x: margin, y: taxLabelY - 13 - index * 9, size: 7.5, font: fonts.regular, color: ink }));

  const totalsX = 352;
  const totalsWidth = rightEdge - totalsX;
  const totalsTop = summaryY + 8;
  const totalsBottom = summaryY - 88;
  page.drawRectangle({ x: totalsX, y: totalsBottom, width: totalsWidth, height: totalsTop - totalsBottom, color: pale, borderColor: line, borderWidth: 0.55 });
  const totals: Array<[string, unknown]> = [["Subtotal", invoice.taxableAmount], ["CGST", invoice.cgstAmount], ["SGST", invoice.sgstAmount], ["IGST", invoice.igstAmount], ["Round Off", invoice.roundOff]];
  totals.forEach(([label, value], index) => {
    const rowY = totalsTop - 18 - index * 12;
    page.drawText(label, { x: totalsX + 13, y: rowY, size: 7.2, font: fonts.regular, color: ink });
    drawRight(page, currency(value), rightEdge - 11, rowY, 7.2, fonts.currency, ink);
  });
  page.drawRectangle({ x: totalsX, y: totalsBottom, width: totalsWidth, height: 22, color: navy });
  page.drawText("GRAND TOTAL", { x: totalsX + 13, y: totalsBottom + 7, size: 8, font: fonts.bold, color: white });
  drawRight(page, currency(invoice.grandTotal), rightEdge - 11, totalsBottom + 7, 8, fonts.currency, white);

  page.drawLine({ start: { x: margin, y: footerLineY }, end: { x: rightEdge, y: footerLineY }, thickness: 0.9, color: gold });
  page.drawText("BANK DETAILS", { x: margin, y: footerLineY - 17, size: 8, font: fonts.bold, color: purple });
  const bank = invoice.companyBankAccounts[0];
  const bankFields: Array<[string, string]> = [["Bank Name", placeholder(bank?.bankName)], ["A/c No.", placeholder(bank?.accountNumber)], ["IFSC Code", placeholder(bank?.ifsc)], ["Branch", placeholder(bank?.branch)]];
  bankFields.forEach(([label, value], index) => {
    const rowY = footerLineY - 31 - index * 12;
    page.drawText(label, { x: margin, y: rowY, size: 7.2, font: fonts.regular, color: muted });
    page.drawText(":", { x: 93, y: rowY, size: 7.2, font: fonts.regular, color: muted });
    page.drawText(value, { x: 101, y: rowY, size: 7.2, font: fonts.regular, color: ink });
  });

  page.drawText("Company's PAN : " + placeholder(invoice.company.pan), { x: 220, y: footerLineY - 17, size: 7.2, font: fonts.regular, color: ink });
  page.drawText("Declaration", { x: 220, y: footerLineY - 33, size: 8, font: fonts.bold, color: purple });
  wrap(placeholder(invoice.company.declaration ?? "We declare that all particulars are true and correct."), fonts.regular, 7.4, 190).slice(0, 4).forEach((lineText, index) => page.drawText(lineText, { x: 220, y: footerLineY - 48 - index * 9, size: 7.4, font: fonts.regular, color: ink }));

  page.drawRectangle({ x: 420, y: 122, width: 147, height: 88, color: rgb(0.985, 0.987, 0.99), borderColor: line, borderWidth: 0.45 });
  drawRight(page, "For " + invoice.company.name.toUpperCase(), 555, footerLineY - 17, 7.2, fonts.bold, navy);
  page.drawLine({ start: { x: 432, y: footerLineY - 62 }, end: { x: 555, y: footerLineY - 62 }, thickness: 0.65, color: ink });
  drawCenter(page, placeholder(invoice.company.authorizedSignatory ?? "Authorised Signatory"), 493.5, footerLineY - 76, 7.2, fonts.regular, ink);

  const footerText = (invoice.company.defaultJurisdiction ? "Subject to " + invoice.company.defaultJurisdiction : "Subject to jurisdiction") + "   •   This is a Computer Generated Invoice";
  const footerWidth = fonts.regular.widthOfTextAtSize(footerText, 6.5);
  const footerCenter = 297.5;
  page.drawLine({ start: { x: margin, y: 40 }, end: { x: footerCenter - footerWidth / 2 - 12, y: 40 }, thickness: 0.5, color: gold });
  page.drawLine({ start: { x: footerCenter + footerWidth / 2 + 12, y: 40 }, end: { x: rightEdge, y: 40 }, thickness: 0.5, color: gold });
  drawCenter(page, footerText, footerCenter, 28, 6.5, fonts.regular, muted);
  return pdf.save();
}
