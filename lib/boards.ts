import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardPlacements, boards } from "@/lib/db/schema";
import type { ItemKind } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import {
  BOARD_PRESETS,
  clampPlacement,
  isValidHex,
  normalizeTitle,
  validatePlacements,
  type BoardPresetName,
  type PlacementInput,
} from "@/lib/board-shared";

export * from "@/lib/board-shared";

export interface PlacementData extends PlacementInput {
  id: string;
  kind: ItemKind;
  title: string | null;
  sourceUrl: string | null;
  variants: Record<string, string> | null;
  mediaRole: string | null;
  colors: string[];
}

export interface BoardDetail {
  id: string;
  title: string;
  background: string;
  canvasW: number;
  canvasH: number;
  updatedAt: Date;
  placements: PlacementData[];
}

export interface BoardSummary {
  id: string;
  title: string;
  background: string;
  canvasW: number;
  canvasH: number;
  updatedAt: Date;
  count: number;
}

export async function createBoard(preset: BoardPresetName = "free", title?: string): Promise<string> {
  const id = newId();
  const dims = BOARD_PRESETS[preset] ?? BOARD_PRESETS.free;
  await db.insert(boards).values({
    id,
    title: normalizeTitle(title ?? ""),
    background: "#0a0a0a",
    canvasW: dims.w,
    canvasH: dims.h,
  });
  return id;
}

export interface BoardMeta {
  id: string;
  title: string;
  background: string;
  canvasW: number;
  canvasH: number;
  updatedAt: Date;
}

export async function getBoardMeta(id: string): Promise<BoardMeta | null> {
  const rows = await db
    .select({
      id: boards.id,
      title: boards.title,
      background: boards.background,
      canvasW: boards.canvasW,
      canvasH: boards.canvasH,
      updatedAt: boards.updatedAt,
    })
    .from(boards)
    .where(eq(boards.id, id))
    .limit(1);
  return rows[0] ?? null;
}

interface PlacementRow {
  id: string;
  item_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  show_label: boolean;
  kind: ItemKind;
  title: string | null;
  source_url: string | null;
  media_role: string | null;
  variants: Record<string, string> | null;
  colors: string[] | null;
}

export async function getBoardDetail(id: string): Promise<BoardDetail | null> {
  const meta = await getBoardMeta(id);
  if (!meta) return null;
  const res = await db.execute(sql`
    select bp.id, bp.item_id, bp.x, bp.y, bp.w, bp.h, bp.z, bp.show_label,
      i.kind, i.title, s.url as source_url,
      m.role as media_role, m.variants as variants,
      coalesce((select json_agg(ic.hex order by ic.position) from item_colors ic where ic.item_id = bp.item_id), '[]'::json) as colors
    from board_placements bp
    join items i on i.id = bp.item_id
    left join item_sources s on s.item_id = bp.item_id
    left join media_assets m on m.item_id = bp.item_id
      and m.role = (case when i.kind in ('screenshot', 'photo') then 'primary' else 'preview' end)
    where bp.board_id = ${id}
    order by bp.z asc, bp.created_at asc
  `);
  const placements = (res.rows as unknown as PlacementRow[]).map((r) => ({
    id: r.id,
    itemId: r.item_id,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    z: r.z,
    showLabel: r.show_label,
    kind: r.kind,
    title: r.title,
    sourceUrl: r.source_url,
    variants: r.variants ?? null,
    mediaRole: r.media_role ?? null,
    colors: Array.isArray(r.colors) ? r.colors : [],
  }));
  return { ...meta, placements };
}

export async function listBoards(): Promise<BoardSummary[]> {
  const res = await db.execute(sql`
    select b.id, b.title, b.background, b.canvas_w, b.canvas_h, b.updated_at,
      (select count(*)::int from board_placements bp where bp.board_id = b.id) as count
    from boards b
    order by b.updated_at desc
  `);
  return (res.rows as unknown as {
    id: string;
    title: string;
    background: string;
    canvas_w: number;
    canvas_h: number;
    updated_at: string | Date;
    count: number;
  }[]).map((r) => ({
    id: r.id,
    title: r.title,
    background: r.background,
    canvasW: r.canvas_w,
    canvasH: r.canvas_h,
    updatedAt: new Date(r.updated_at),
    count: r.count,
  }));
}

export async function updateBoardMeta(
  id: string,
  patch: { title?: string; background?: string; canvasW?: number; canvasH?: number },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = normalizeTitle(patch.title);
  if (patch.background !== undefined && isValidHex(patch.background)) set.background = patch.background.toLowerCase();
  if (patch.canvasW !== undefined && patch.canvasH !== undefined) {
    set.canvasW = patch.canvasW;
    set.canvasH = patch.canvasH;
  }
  await db.update(boards).set(set).where(eq(boards.id, id));
  if (set.canvasW !== undefined) {
    const detail = await getBoardDetail(id);
    if (detail) {
      const canvas = { w: set.canvasW as number, h: set.canvasH as number };
      const clamped = detail.placements
        .map((p) => clampPlacement(p, canvas))
        .filter((p): p is PlacementInput => p !== null);
      await savePlacements(id, clamped);
    }
  }
}

export async function savePlacements(boardId: string, placements: PlacementInput[]): Promise<void> {
  await db.delete(boardPlacements).where(eq(boardPlacements.boardId, boardId));
  if (placements.length === 0) return;
  await db.insert(boardPlacements).values(
    placements.map((p) => ({
      id: newId(),
      boardId,
      itemId: p.itemId,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      z: p.z,
      showLabel: p.showLabel,
    })),
  );
}

export async function deleteBoard(id: string): Promise<void> {
  await db.delete(boards).where(eq(boards.id, id));
}
