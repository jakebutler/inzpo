if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem } = await import("../lib/items");
const { createBoard, deleteBoard, getBoardDetail } = await import("../lib/boards");
const { addItemsToBoard, removeFromBoard, getBoards, getItemBoards } = await import("../lib/item-boards");
const { db } = await import("../lib/db");
const { inArray } = await import("drizzle-orm");
const { items } = await import("../lib/db/schema");

function img(r: number, g: number, b: number) {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

function inCanvas(r: { x: number; y: number; w: number; h: number }, w: number, h: number) {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
}

const itemIds: string[] = [];
let boardId = "";

try {
  const a = await createImageItem({ buffer: await img(120, 80, 40), filename: "boards-int-e2e-a.png" });
  const b = await createImageItem({ buffer: await img(40, 120, 80), filename: "boards-int-e2e-b.png" });
  itemIds.push(a, b);
  boardId = await createBoard("16:9", "E2E integration board");

  await addItemsToBoard(boardId, [a, b]);
  let detail = await getBoardDetail(boardId);
  if (!detail || detail.placements.length !== 2) throw new Error("expected 2 placements after add");
  if (detail.placements[0].itemId !== a || detail.placements[1].itemId !== b) throw new Error("append order not preserved");
  if (detail.placements[1].z <= detail.placements[0].z) throw new Error("z not ascending across appended items");
  for (const p of detail.placements) {
    if (!inCanvas(p, detail.canvasW, detail.canvasH)) throw new Error("placement outside canvas after band pack");
  }
  if (!(await getBoards()).some((s) => s.id === boardId)) throw new Error("getBoards missing the board");
  const membership = await getItemBoards(b);
  if (!membership.some((m) => m.id === boardId && m.name === "E2E integration board")) throw new Error("getItemBoards wrong");
  console.log("✓ addItemsToBoard appends both items in order, z ascending, rects within canvas");

  await addItemsToBoard(boardId, [b]);
  detail = await getBoardDetail(boardId);
  if (!detail || detail.placements.length !== 2) throw new Error("duplicate add created a second placement");
  console.log("✓ re-adding a placed item changes nothing");

  await removeFromBoard(boardId, a);
  detail = await getBoardDetail(boardId);
  if (!detail || detail.placements.length !== 1 || detail.placements[0].itemId !== b) throw new Error("removeFromBoard removed the wrong placement");
  if ((await getItemBoards(a)).some((m) => m.id === boardId)) throw new Error("membership lingered after removal");
  console.log("✓ removeFromBoard drops only the target membership");

  await addItemsToBoard(boardId, [a]);
  detail = await getBoardDetail(boardId);
  if (!detail || detail.placements.length !== 2) throw new Error("expected 2 placements after re-add");
  if (detail.placements[0].itemId !== b || detail.placements[1].itemId !== a) throw new Error("re-added item should append after survivors");
  for (const p of detail.placements) {
    if (!inCanvas(p, detail.canvasW, detail.canvasH)) throw new Error("placement outside canvas after re-add");
  }
  console.log("✓ re-add appends after survivors, still within canvas");

  console.log("boards integration e2e passed");
} finally {
  if (boardId) await deleteBoard(boardId).catch(() => {});
  if (itemIds.length > 0) await db.delete(items).where(inArray(items.id, itemIds)).catch(() => {});
}
