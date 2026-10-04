import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { issueInvoice } from "@/lib/server/invoice-service";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("invoice.issue");
    const { id } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    const result = await issueInvoice({ ...body, companyId: session.user.companyId, userId: session.user.id, idempotencyKey: request.headers.get("idempotency-key") ?? body.idempotencyKey }, id);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
