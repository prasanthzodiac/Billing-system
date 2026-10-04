import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getEnv } from "@/lib/server/env";

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed.", details: error.flatten().fieldErrors }, { status: 422 });
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "You do not have permission for this action." }, { status: 403 });
  if (error instanceof Error && error.message === "INVALID_ORIGIN") return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  if (error instanceof Error && error.message.startsWith("CONFLICT:")) return NextResponse.json({ error: error.message.slice("CONFLICT:".length) }, { status: 409 });
  if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) return NextResponse.json({ error: error.message.slice("BAD_REQUEST:".length) }, { status: 400 });
  console.error("Unhandled request error", error instanceof Error ? { name: error.name, message: error.message } : { error });
  return NextResponse.json({ error: "Unable to complete the request." }, { status: 500 });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") throw new Error("INVALID_ORIGIN");
    return;
  }
  const requestUrl = new URL(request.url);
  const trustedProxy = getEnv().TRUST_PROXY === "true";
  const forwardedProto = trustedProxy ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() : undefined;
  const requestProtocol = forwardedProto || requestUrl.protocol.slice(0, -1);
  const requestHost = trustedProxy ? (request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || requestUrl.host) : (request.headers.get("host") || requestUrl.host);
  const requestOrigin = `${requestProtocol}://${requestHost}`;
  if (origin !== requestOrigin && origin !== requestUrl.origin) throw new Error("INVALID_ORIGIN");
}

export function requestClientKey(request: Request) {
  if (getEnv().TRUST_PROXY !== "true") return "unknown";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
