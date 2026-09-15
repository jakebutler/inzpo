import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getBoardDetail } from "@/lib/boards";
import {
  exportDimensions,
  renderBoardToBuffer,
  tileForPlacement,
  validateExportParams,
  withinExportBounds,
} from "@/lib/board-render";

export const dynamic = "force-dynamic";

const CSP = "default-src 'none';";

function slugify(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "board";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return new NextResponse(null, { status: 401 });
  }

  const query = new URL(request.url).searchParams;
  const opts = validateExportParams(query.get("format"), query.get("scale"));
  if (!opts) {
    return NextResponse.json({ error: "invalid export params: format must be png or webp, scale 1 or 2" }, { status: 400 });
  }

  const { id } = await params;
  const board = await getBoardDetail(id);
  if (!board) return new NextResponse(null, { status: 404 });

  const dims = exportDimensions(board, opts.scale);
  if (!withinExportBounds(dims)) {
    return NextResponse.json(
      { error: `export too large: ${dims.width}x${dims.height} exceeds the 4096px max side` },
      { status: 400 },
    );
  }

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
      { scale: opts.scale, labels, format: opts.format },
    );
    const ext = opts.format;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": `image/${ext}`,
        "Content-Length": String(buf.byteLength),
        "Content-Disposition": `attachment; filename="${slugify(board.title)}-${dims.width}x${dims.height}.${ext}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": CSP,
      },
    });
  } catch (e) {
    console.error("board export failed", e);
    return new NextResponse(null, { status: 500 });
  }
}
