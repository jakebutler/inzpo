import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getBoardDetail } from "@/lib/boards";
import { renderBoardToBuffer, tileForPlacement } from "@/lib/board-render";

export const dynamic = "force-dynamic";

const CSP = "default-src 'none';";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;
  const board = await getBoardDetail(id);
  if (!board) return new NextResponse(null, { status: 404 });

  const wRaw = Number(new URL(request.url).searchParams.get("w") ?? "800");
  const w = Number.isFinite(wRaw) ? Math.max(64, Math.min(Math.round(wRaw), 1600)) : 800;
  const scale = Math.min(1, w / board.canvasW);

  const tiles = board.placements.map((p) => ({
    rect: { x: p.x, y: p.y, w: p.w, h: p.h },
    spec: tileForPlacement(p),
  }));
  const labels = board.placements
    .filter((p) => p.showLabel)
    .map((p) => ({ rect: { x: p.x, y: p.y, w: p.w, h: p.h }, text: p.title ?? "Untitled" }));

  try {
    const buf = await renderBoardToBuffer(
      { canvasW: board.canvasW, canvasH: board.canvasH, background: board.background },
      tiles,
      { scale, labels },
    );
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": CSP,
      },
    });
  } catch (e) {
    console.error("board render failed", e);
    return new NextResponse(null, { status: 500 });
  }
}
