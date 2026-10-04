import { NextRequest, NextResponse } from "next/server";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireAnyPermission("dashboard.read", "invoice.create", "payment.create", "master.write", "report.read");
    const { id } = await context.params;
    const notification = await db.notification.updateMany({ where: { id, companyId: session.user.companyId, userId: session.user.id }, data: { readAt: new Date() } });
    if (!notification.count) throw new Error("BAD_REQUEST:Notification was not found.");
    return NextResponse.json({ data: { id, read: true } });
  } catch (error) { return jsonError(error); }
}
