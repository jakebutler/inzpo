"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BOARD_PRESETS,
  createBoard,
  deleteBoard,
  getBoardMeta,
  isValidHex,
  savePlacements,
  updateBoardMeta,
  validatePlacements,
  type BoardPresetName,
} from "@/lib/boards";
import { addItemsToBoard, removeFromBoard } from "@/lib/item-boards";
import { resolveIds } from "./bulk";
import { requireOwnerId } from "@/lib/auth/owner";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export async function createBoardAction(fd: FormData) {
  const ownerId = await requireOwnerId();
  const presetName = str(fd, "preset");
  const preset = (presetName in BOARD_PRESETS ? presetName : "free") as BoardPresetName;
  const id = await createBoard(ownerId, preset, str(fd, "title"));
  revalidatePath("/boards");
  redirect(`/boards/${id}`);
}

export async function updateBoardAction(fd: FormData) {
  const ownerId = await requireOwnerId();
  const id = str(fd, "id");
  if (!id) return;
  const patch: { title?: string; background?: string; canvasW?: number; canvasH?: number } = {};
  const title = str(fd, "title");
  if (title !== "") patch.title = title;
  const background = str(fd, "background");
  if (background !== "" && isValidHex(background)) patch.background = background;
  const preset = str(fd, "preset");
  if (preset in BOARD_PRESETS) {
    patch.canvasW = BOARD_PRESETS[preset as BoardPresetName].w;
    patch.canvasH = BOARD_PRESETS[preset as BoardPresetName].h;
  }
  await updateBoardMeta(ownerId, id, patch);
  revalidatePath("/boards");
  revalidatePath(`/boards/${id}`);
}

export async function savePlacementsAction(fd: FormData) {
  const ownerId = await requireOwnerId();
  const id = str(fd, "id");
  if (!id) return;
  const board = await getBoardMeta(ownerId, id);
  if (!board) return;
  const rawJson = str(fd, "placements");
  if (rawJson.length > 64_000) return;
  let raw: unknown;
  try {
    raw = JSON.parse(rawJson);
  } catch {
    return;
  }
  const placements = validatePlacements(raw, { w: board.canvasW, h: board.canvasH });
  await savePlacements(ownerId, id, placements);
  revalidatePath(`/boards/${id}`);
  revalidatePath("/boards");
}

export async function deleteBoardAction(fd: FormData) {
  const ownerId = await requireOwnerId();
  const id = str(fd, "id");
  if (!id) return;
  await deleteBoard(ownerId, id);
  revalidatePath("/boards");
  redirect("/boards");
}

export async function bulkBoardAction(fd: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const ids = await resolveIds(fd);
  if (ids.length === 0) return;
  let boardId = str(fd, "boardId");
  const newName = str(fd, "newName").trim();
  if (!boardId && newName.length > 0) boardId = await createBoard(ownerId, "16:9", newName);
  if (!boardId) return;
  await addItemsToBoard(ownerId, boardId, ids);
  revalidatePath("/");
  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
}

export async function addItemToBoardAction(fd: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const itemId = str(fd, "itemId");
  const boardId = str(fd, "boardId");
  if (!itemId || !boardId) return;
  await addItemsToBoard(ownerId, boardId, [itemId]);
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
}

export async function removeItemFromBoardAction(fd: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const itemId = str(fd, "itemId");
  const boardId = str(fd, "boardId");
  if (!itemId || !boardId) return;
  await removeFromBoard(ownerId, boardId, itemId);
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
}

export async function createBoardWithItemAction(fd: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const itemId = str(fd, "itemId");
  const newName = str(fd, "newName").trim();
  if (!itemId || newName.length === 0) return;
  const boardId = await createBoard(ownerId, "16:9", newName);
  await addItemsToBoard(ownerId, boardId, [itemId]);
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/boards");
  revalidatePath(`/boards/${boardId}`);
}
