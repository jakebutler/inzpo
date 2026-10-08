import { NextRequest, NextResponse } from "next/server";
import { countWallItems } from "@/lib/items";
import { parseFilterParam } from "@/lib/filter";
import { optionalOwnerId } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ownerId = await optionalOwnerId();
  if (!ownerId) return NextResponse.json({ count: 0 }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { f?: string } | string | null;
  const f = typeof body === "string" ? body : body?.f ?? null;
  const state = parseFilterParam(f);
  const count = await countWallItems(ownerId, state);
  return NextResponse.json({ count });
}
