import { NextRequest, NextResponse } from "next/server";

import { destroyCurrentSession, requireSession } from "@/lib/server/auth";
import { assertSameOrigin, jsonError } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireSession();
    await destroyCurrentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
