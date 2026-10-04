import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { jsonError } from "@/lib/server/http";
import { parsePagination } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("admin.write");
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const where = { companyId: session.user.companyId };
    const [data, total] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, action: true, entityType: true, entityId: true, userId: true, user: { select: { name: true } }, previousValue: true, newValue: true, createdAt: true } }), db.auditLog.count({ where })]);
    return NextResponse.json({ data, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}
