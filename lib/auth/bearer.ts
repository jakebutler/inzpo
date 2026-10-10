import { verifyToken } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ApiError } from "@inzpo/shared";
import { devOwnerId } from "@/lib/auth/dev-bypass";
import { isClerkConfigured } from "@/lib/auth/clerk-configured";

export async function ownerIdFromBearer(request: Request): Promise<string | null> {
  const bypass = devOwnerId();
  if (bypass) return bypass;
  if (!isClerkConfigured()) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
  if (!match) return null;
  try {
    const payload = await verifyToken(match[1]!, { secretKey: process.env.CLERK_SECRET_KEY });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function requireMobileOwner(
  request: Request,
): Promise<{ ownerId: string } | NextResponse<ApiError>> {
  const ownerId = await ownerIdFromBearer(request);
  return ownerId ? { ownerId } : NextResponse.json<ApiError>({ error: "unauthorized" }, { status: 401 });
}
