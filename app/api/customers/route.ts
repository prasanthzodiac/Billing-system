import { NextRequest, NextResponse } from "next/server";

import { requireAnyPermission } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { customerSchema } from "@/lib/server/schemas";
import { assertSameOrigin, jsonError } from "@/lib/server/http";
import { parsePagination, readJson } from "@/lib/server/query";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAnyPermission("invoice.create", "master.write", "report.read");
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const { page, pageSize } = parsePagination(request.nextUrl.searchParams, 100);
    const where = { companyId: session.user.companyId, active: true, ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { gstin: { contains: query, mode: "insensitive" as const } }, { phone: { contains: query } }] } : {}) };
    const [data, total] = await Promise.all([db.customer.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, name: true, billingAddress: true, deliveryAddress: true, city: true, district: true, state: true, stateCode: true, pinCode: true, gstin: true, pan: true, phone: true, alternatePhone: true, email: true, creditLimit: true, creditPeriod: true, openingBalance: true, notes: true, active: true } }), db.customer.count({ where })]);
    return NextResponse.json({ data, page, pageSize, total });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireAnyPermission("master.write");
    const input = customerSchema.parse(await readJson(request));
    const customer = await db.customer.create({ data: { ...input, companyId: session.user.companyId }, select: { id: true, name: true, gstin: true, state: true, stateCode: true } });
    await db.auditLog.create({ data: { companyId: session.user.companyId, userId: session.user.id, action: "CUSTOMER_CREATED", entityType: "Customer", entityId: customer.id, newValue: customer } });
    await db.notification.create({ data: { companyId: session.user.companyId, userId: session.user.id, type: "SUCCESS", title: "Customer added", message: `${customer.name} is ready for invoicing.`, entityType: "Customer", entityId: customer.id, href: "/?view=Customers" } });
    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
