import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { readJson, parsePagination } from "@/lib/server/query";
import { transporterSchema } from "@/lib/server/schemas";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("invoice.create");
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const where = { companyId: session.user.companyId, active: true, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { phone: { contains: query } }] } : {}) };
    const [data, total] = await Promise.all([db.transporter.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }), db.transporter.count({ where })]);
    return NextResponse.json({ data, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admin.write");
    const input = transporterSchema.parse(await readJson(request));
    const transporter = await db.transporter.create({ data: { ...input, companyId: session.user.companyId } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "TRANSPORTER_CREATED", entityType: "Transporter", entityId: transporter.id, newValue: { name: transporter.name, phone: transporter.phone } } });
    return NextResponse.json({ data: transporter }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
