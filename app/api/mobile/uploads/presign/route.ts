import { NextResponse } from "next/server";
import type { PresignUploadRequest, PresignUploadResponse } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { presignUpload, validateUpload } from "@/lib/uploads";
import { mobileError, mobileServerError, readMobileJson } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const body = await readMobileJson(request);
  if (typeof body?.contentType !== "string" || typeof body.bytes !== "number") {
    return mobileError("contentType and bytes are required", 400);
  }
  const input: PresignUploadRequest = { contentType: body.contentType, bytes: body.bytes };
  try {
    validateUpload(input);
  } catch (error) {
    return mobileError(error instanceof Error ? error.message : "Invalid upload", 400);
  }
  try {
    const signed = await presignUpload({ ownerId: auth.ownerId, ...input });
    return NextResponse.json<PresignUploadResponse>(signed);
  } catch (error) {
    return mobileServerError(error);
  }
}
