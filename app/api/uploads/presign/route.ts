import { NextRequest, NextResponse } from "next/server";
import { optionalOwnerId } from "@/lib/auth/owner";
import { presignUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ownerId = await optionalOwnerId();
  if (!ownerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { contentType?: string; bytes?: number } | null;
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const bytes = typeof body?.bytes === "number" ? body.bytes : NaN;
  try {
    const signed = await presignUpload({ ownerId, contentType, bytes });
    return NextResponse.json(signed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
