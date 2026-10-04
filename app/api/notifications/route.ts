import { NextRequest, NextResponse } from "next/server";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAnyPermission("dashboard.read", "invoice.create", "payment.create", "master.write", "report.read");
    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "20")));
    const where = { companyId: session.user.companyId, userId: session.user.id };
    const [data, unreadCount] = await Promise.all([
      db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, type: true, title: true, message: true, entityType: true, entityId: true, href: true, readAt: true, createdAt: true } }),
      db.notification.count({ where: { ...where, readAt: null } })
    ]);
    return NextResponse.json({ data, unreadCount });
  } catch (error) { return jsonError(error); }
}
