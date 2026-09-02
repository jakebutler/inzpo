import { NextRequest, NextResponse } from "next/server";
import { countWallItems } from "@/lib/items";
import { parseFilterParam } from "@/lib/filter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { f?: string } | string | null;
  const f = typeof body === "string" ? body : body?.f ?? null;
  const state = parseFilterParam(f);
  const count = await countWallItems(state);
  return NextResponse.json({ count });
}
