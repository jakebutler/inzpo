import { NextResponse } from "next/server";
import type { ApiError, BriefJob } from "@inzpo/shared";

export type MobileKitContext = { params: Promise<{ id: string }> };

export async function readMobileJson(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

export function mobileError(error: string, status: number): NextResponse<ApiError> {
  return NextResponse.json<ApiError>({ error }, { status });
}

export function mobileServerError(error: unknown): NextResponse<ApiError> {
  if (error instanceof Error && error.message === "Not found") return mobileError("Not found", 404);
  return mobileError("Could not complete request", 500);
}

export function pendingBrief(): BriefJob {
  return { status: "pending", text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 };
}
