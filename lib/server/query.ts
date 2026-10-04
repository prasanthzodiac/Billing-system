import { z } from "zod";

import type { InvoiceStatus } from "@prisma/client";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25)
});

export function parsePagination(searchParams: URLSearchParams, maxPageSize = 100) {
  const parsed = paginationSchema.parse({ page: searchParams.get("page") ?? undefined, pageSize: searchParams.get("pageSize") ?? undefined });
  return { page: parsed.page, pageSize: Math.min(maxPageSize, parsed.pageSize) };
}

const invoiceStatuses = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;

export function parseInvoiceStatus(value: string | null): InvoiceStatus | null {
  if (!value) return null;
  if (!invoiceStatuses.includes(value as (typeof invoiceStatuses)[number])) throw new Error("BAD_REQUEST:Invalid invoice status filter.");
  return value as InvoiceStatus;
}

export function parseDateRange(searchParams: URLSearchParams) {
  const now = new Date();
  const from = parseDateBoundary(searchParams.get("from") ?? `${now.getUTCFullYear()}-01-01`, "start");
  const to = parseDateBoundary(searchParams.get("to") ?? now.toISOString(), "end");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new Error("BAD_REQUEST:Invalid report date range.");
  return { from, to };
}

export function parseOptionalDateRange(searchParams: URLSearchParams) {
  const fromValue = searchParams.get("from");
  const toValue = searchParams.get("to");
  if (!fromValue && !toValue) return undefined;
  const from = fromValue ? parseDateBoundary(fromValue, "start") : undefined;
  const to = toValue ? parseDateBoundary(toValue, "end") : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new Error("BAD_REQUEST:Invalid invoice date range.");
  return { gte: from, lte: to };
}

export function parseInvoiceMonth(value: string | null): number | null {
  if (!value || value === "ALL") return null;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("BAD_REQUEST:Invalid invoice month filter.");
  return month;
}

function parseDateBoundary(value: string, boundary: "start" | "end") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  return new Date(value);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error("BAD_REQUEST:Malformed JSON request body.");
  }
}
