import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { recordInventoryAdjustment } from "@/lib/server/financial-commands";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson } from "@/lib/server/query";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("master.write");
    const body = await readJson<Record<string, unknown>>(request);
    const result = await recordInventoryAdjustment({ ...body, idempotencyKey: request.headers.get("idempotency-key") ?? body.idempotencyKey }, session.user.id, session.user.companyId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
