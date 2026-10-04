import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { cancelInvoice } from "@/lib/server/financial-commands";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("invoice.cancel");
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const result = await cancelInvoice({ ...body, invoiceId: id, idempotencyKey: request.headers.get("idempotency-key") ?? body.idempotencyKey }, session.user.id, session.user.companyId);
    return NextResponse.json({ data: result });
  } catch (error) { return jsonError(error); }
}
