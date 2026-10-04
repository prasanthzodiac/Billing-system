import { NextResponse } from "next/server";

import { readSession } from "@/lib/server/auth";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { id: session.user.id, name: session.user.name, email: session.user.email }, permissions: [...session.permissions] });
}

