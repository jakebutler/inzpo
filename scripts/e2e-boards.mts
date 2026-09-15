if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sharp = (await import("sharp")).default;
const { createImageItem } = await import("../lib/items");
const { createBoard, getBoardDetail, listBoards, savePlacements, updateBoardMeta, deleteBoard, validatePlacements } = await import("../lib/boards");
const { packGridFull } = await import("../lib/board-arrange");
const { renderBoardToBuffer, tileForPlacement } = await import("../lib/board-render");
const { exportDimensions, validateExportParams, withinExportBounds } = await import("../lib/board-render");
const { db } = await import("../lib/db");
const { itemColors, itemSources, items } = await import("../lib/db/schema");
const { eq, inArray } = await import("drizzle-orm");
const { newId } = await import("../lib/ids");

function img(r: number, g: number, b: number) {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

const itemIds: string[] = [];
let boardId = "";
let exportBoardId = "";

try {
  const a = await createImageItem({ buffer: await img(120, 80, 40), filename: "board-e2e-a.png" });
  const b = await createImageItem({ buffer: await img(40, 120, 80), filename: "board-e2e-b.png" });
  itemIds.push(a, b);

  const linked = newId();
  await db.insert(items).values({ id: linked, kind: "url", title: "E2E linked item" });
  await db.insert(itemSources).values({ itemId: linked, url: "https://example.com/board-e2e", urlNormalized: "example.com/board-e2e" });
  itemIds.push(linked);

  const pal = newId();
  await db.insert(items).values({ id: pal, kind: "palette", title: "E2E palette" });
  await db.insert(itemColors).values(
    ["#112233", "#445566", "#778899"].map((hex, i) => ({ id: newId(), itemId: pal, hex, family: "blue", origin: "palette", position: i })),
  );
  itemIds.push(pal);

  boardId = await createBoard("16:9", "E2E board");
  const rects = packGridFull(4, { w: 1600, h: 900 });
  await savePlacements(boardId, validatePlacements(
    rects.map((r, i) => ({ itemId: itemIds[i], ...r, z: i, showLabel: i === 0 })),
    { w: 1600, h: 900 },
  ));

  let detail = await getBoardDetail(boardId);
  if (!detail || detail.placements.length !== 4) throw new Error("placements missing after save");
  const specs = detail.placements.map((p) => tileForPlacement(p));
  if (specs.filter((s) => s.type === "image").length !== 2) throw new Error("image tiles wrong");
  if (specs.find((s) => s.type === "fallback") === undefined) throw new Error("fallback tile missing");
  const palette = specs.find((s) => s.type === "palette");
  if (!palette || palette.type !== "palette" || palette.colors.length !== 3) throw new Error("palette tile wrong");
  console.log("✓ placement tiles resolve per kind");

  const buf = await renderBoardToBuffer(
    detail,
    detail.placements.map((p) => ({ rect: { x: p.x, y: p.y, w: p.w, h: p.h }, spec: tileForPlacement(p) })),
    {
      scale: 0.5,
      labels: detail.placements
        .filter((p) => p.showLabel)
        .map((p) => ({ rect: { x: p.x, y: p.y, w: p.w, h: p.h }, text: p.title ?? "Untitled" })),
    },
  );
  const meta = await sharp(buf).metadata();
  if (meta.width !== 800 || meta.height !== 450) throw new Error(`render dims wrong: ${meta.width}x${meta.height}`);
  console.log("✓ board renders at requested scale (800×450)");

  await db.delete(items).where(eq(items.id, linked));
  detail = await getBoardDetail(boardId);
  if (!detail || detail.placements.length !== 3) throw new Error("item deletion did not cascade to placements");
  console.log("✓ deleting an item removes only its placements");

  await updateBoardMeta(boardId, { canvasW: 900, canvasH: 1600, background: "#f5f5f5" });
  detail = await getBoardDetail(boardId);
  if (!detail) throw new Error("board missing after meta update");
  for (const p of detail.placements) {
    if (p.x < 0 || p.y < 0 || p.x + p.w > 900 || p.y + p.h > 1600) throw new Error("placement out of bounds after canvas change");
  }
  if (detail.background !== "#f5f5f5") throw new Error("background not updated");
  console.log("✓ canvas resize clamps placements, meta updates stick");

  const summary = await listBoards();
  if (!summary.some((s) => s.id === boardId && s.count === 3)) throw new Error("board summary wrong");
  console.log("✓ boards index lists the board with a live count");

  await deleteBoard(boardId);
  boardId = "";
  const survivors = await db.select({ id: items.id }).from(items).where(inArray(items.id, itemIds));
  if (survivors.length !== itemIds.length - 1) throw new Error("board deletion touched items");
  console.log("✓ deleting a board leaves Items intact");

  exportBoardId = await createBoard("1:1", "E2E export board");
  const palId = itemIds[itemIds.length - 1];
  await savePlacements(exportBoardId, validatePlacements(
    [{ itemId: palId, x: 400, y: 400, w: 800, h: 800, z: 0, showLabel: true }],
    { w: 1600, h: 1600 },
  ));
  const exportDetail = await getBoardDetail(exportBoardId);
  if (!exportDetail || exportDetail.placements.length !== 1) throw new Error("export board placements missing");
  if (!withinExportBounds({ width: 3200, height: 3200 }) || withinExportBounds({ width: 4097, height: 1 })) {
    throw new Error("export bounds wrong");
  }
  const exportTiles = exportDetail.placements.map((p) => ({ rect: { x: p.x, y: p.y, w: p.w, h: p.h }, spec: tileForPlacement(p) }));
  const exportLabels = exportDetail.placements
    .filter((p) => p.showLabel)
    .map((p) => ({ rect: { x: p.x, y: p.y, w: p.w, h: p.h }, text: p.title ?? "Untitled" }));
  for (const scale of [1, 2] as const) {
    const out = await renderBoardToBuffer(exportDetail, exportTiles, { scale, labels: exportLabels });
    if (out.subarray(0, 4).toString("latin1") !== "\x89PNG") throw new Error(`scale ${scale}: export is not a PNG`);
    const want = exportDimensions(exportDetail, scale);
    const m = await sharp(out).metadata();
    if (m.width !== want.width || m.height !== want.height) {
      throw new Error(`scale ${scale}: export dims ${m.width}x${m.height}, expected ${want.width}x${want.height}`);
    }
  }
  if (validateExportParams("svg", "1") !== null) throw new Error("export params accepted svg");
  if (validateExportParams("png", "3") !== null) throw new Error("export params accepted scale 3");
  console.log("✓ export renders PNG at scale 1 and 2 with guarded params");

  await deleteBoard(exportBoardId);
  exportBoardId = "";

  console.log("boards e2e passed");
} finally {
  if (boardId) await deleteBoard(boardId).catch(() => {});
  if (exportBoardId) await deleteBoard(exportBoardId).catch(() => {});
  if (itemIds.length > 0) await db.delete(items).where(inArray(items.id, itemIds)).catch(() => {});
}
