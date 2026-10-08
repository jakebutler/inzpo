import { NextRequest, NextResponse } from "next/server";
import { optionalOwnerId } from "@/lib/auth/owner";
import { countWallItems, getWallItems } from "@/lib/items";
import { parseFilterParam } from "@/lib/filter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ownerId = await optionalOwnerId();
  if (!ownerId) {
    return new NextResponse(null, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64_000) {
    return NextResponse.json({ error: "request too large" }, { status: 413 });
  }
  const body = (await request.json().catch(() => null)) as { f?: string; exclude?: string[] } | null;
  const state = parseFilterParam(body?.f ?? null);
  const excludeList = Array.isArray(body?.exclude)
    ? body.exclude.filter((id): id is string => typeof id === "string").slice(0, 100)
    : [];
  const exclude = new Set(excludeList);

  const [rows, total] = await Promise.all([getWallItems(ownerId, state), countWallItems(ownerId, state)]);
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
