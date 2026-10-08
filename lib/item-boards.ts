import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardPlacements, boards } from "@/lib/db/schema";
import { contentBottom, packGridBand } from "@/lib/board-arrange";
import { assertBoardOwned, ownerClause } from "@/lib/auth/owner";
import {
  MAX_PLACEMENTS,
  clampPlacement,
  getBoardDetail,
  listBoards,
  savePlacements,
  type PlacementInput,
} from "@/lib/boards";

export interface BoardOption {
  id: string;
  name: string;
}

export async function getBoards(ownerId: string): Promise<BoardOption[]> {
  const all = await listBoards(ownerId);
  return all.map((b) => ({ id: b.id, name: b.title }));
}

export async function getItemBoards(ownerId: string, itemId: string): Promise<BoardOption[]> {
  return db
    .select({ id: boards.id, name: boards.title })
    .from(boardPlacements)
    .innerJoin(boards, eq(boards.id, boardPlacements.boardId))
    .where(and(eq(boardPlacements.itemId, itemId), ownerClause(boards.ownerId, ownerId)))
    .orderBy(boards.title);
}

export async function addItemsToBoard(ownerId: string, boardId: string, itemIds: string[]): Promise<void> {
  const detail = await getBoardDetail(ownerId, boardId);
  if (!detail) return;
  const placed = new Set(detail.placements.map((p) => p.itemId));
  const fresh = [...new Set(itemIds)]
    .filter((id) => !placed.has(id))
    .slice(0, Math.max(0, MAX_PLACEMENTS - detail.placements.length));
  if (fresh.length === 0) return;
  const canvas = { w: detail.canvasW, h: detail.canvasH };
  const bottom = contentBottom(detail.placements, canvas);
  const zBase = detail.placements.reduce((m, p) => Math.max(m, p.z), -1);
  const packed = packGridBand(fresh.length, canvas, bottom)
    .map((r, i) => ({ itemId: fresh[i], x: r.x, y: r.y, w: r.w, h: r.h, z: zBase + 1 + i, showLabel: false }))
    .map((p) => clampPlacement(p, canvas))
    .filter((p): p is PlacementInput => p !== null);
  await savePlacements(ownerId, boardId, [
    ...detail.placements.map((p) => ({
      itemId: p.itemId,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      z: p.z,
      showLabel: p.showLabel,
    })),
    ...packed,
  ]);
  await db.update(boards).set({ updatedAt: new Date() }).where(eq(boards.id, boardId));
}

export async function removeFromBoard(ownerId: string, boardId: string, itemId: string): Promise<void> {
  await assertBoardOwned(ownerId, boardId);
  await db
    .delete(boardPlacements)
    .where(and(eq(boardPlacements.boardId, boardId), eq(boardPlacements.itemId, itemId)));
  await db.update(boards).set({ updatedAt: new Date() }).where(eq(boards.id, boardId));
}
