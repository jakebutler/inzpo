import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { countWallItems, getWallItems } from "@/lib/items";
import { parseFilterParam } from "@/lib/filter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return new NextResponse(null, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { f?: string; exclude?: string[] } | null;
  const state = parseFilterParam(body?.f ?? null);
  const exclude = new Set(
    Array.isArray(body?.exclude) ? body.exclude.filter((id): id is string => typeof id === "string") : [],
  );

  const [rows, total] = await Promise.all([getWallItems(state), countWallItems(state)]);
  const items = rows
    .filter((r) => !exclude.has(r.id))
    .slice(0, 200)
    .map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      thumb: r.thumbKey,
      aspect: r.aspect,
      colors: r.hexColors,
    }));
  return NextResponse.json({ items, count: total });
}
