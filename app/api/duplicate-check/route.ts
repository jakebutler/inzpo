import { NextRequest, NextResponse } from "next/server";
import { findExistingByNormalizedUrl } from "@/lib/capture-url";
import { normalizeUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url ?? "";
  if (!url) return NextResponse.json({ existing: null });
  const normalized = normalizeUrl(url);
  const existing = await findExistingByNormalizedUrl(normalized);
  return NextResponse.json({ existing: existing ? { itemId: existing.itemId, title: existing.title } : null });
}
