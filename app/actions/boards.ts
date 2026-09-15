"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BOARD_PRESETS,
  createBoard,
  deleteBoard,
  getBoardMeta,
  isValidHex,
  normalizeTitle,
  savePlacements,
  updateBoardMeta,
  validatePlacements,
  type BoardPresetName,
} from "@/lib/boards";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export async function createBoardAction(fd: FormData) {
  const presetName = str(fd, "preset");
  const preset = (presetName in BOARD_PRESETS ? presetName : "free") as BoardPresetName;
  const id = await createBoard(preset, str(fd, "title"));
  revalidatePath("/boards");
  redirect(`/boards/${id}`);
}

export async function updateBoardAction(fd: FormData) {
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
  await updateBoardMeta(id, patch);
  revalidatePath("/boards");
  revalidatePath(`/boards/${id}`);
}

export async function savePlacementsAction(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  const board = await getBoardMeta(id);
  if (!board) return;
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "placements"));
  } catch {
    return;
  }
  const placements = validatePlacements(raw, { w: board.canvasW, h: board.canvasH });
  await savePlacements(id, placements);
  revalidatePath(`/boards/${id}`);
  revalidatePath("/boards");
}

export async function deleteBoardAction(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await deleteBoard(id);
  revalidatePath("/boards");
  redirect("/boards");
}
