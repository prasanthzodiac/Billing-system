import { NextRequest, NextResponse } from "next/server";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireAnyPermission("dashboard.read", "invoice.create", "payment.create", "master.write", "report.read");
    const result = await db.notification.updateMany({ where: { companyId: session.user.companyId, userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ data: { updated: result.count } });
  } catch (error) { return jsonError(error); }
}
