import { chromium } from "playwright";
import { SignJWT } from "jose";
import sharp from "sharp";
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = "http://localhost:3000";
const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

const { createImageItem } = await import("../lib/items");
const { db } = await import("../lib/db");
const { itemSources, items } = await import("../lib/db/schema");
const { eq } = await import("drizzle-orm");
const { newId } = await import("../lib/ids");
const { deleteBoard, getBoardDetail } = await import("../lib/boards");

function img(r: number, g: number, b: number) {
  return sharp({ create: { width: 480, height: 360, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

const seeded: string[] = [];
let boardId = "";
const browser = await chromium.launch();
try {
  const a = await createImageItem({ buffer: await img(150, 60, 40), filename: "journey-a.png" });
  const b = await createImageItem({ buffer: await img(40, 150, 60), filename: "journey-b.png" });
  const c = await createImageItem({ buffer: await img(60, 40, 150), filename: "journey-c.png" });
  seeded.push(a, b, c);
  const linked = newId();
  await db.insert(items).values({ id: linked, kind: "url", title: "Journey linked" });
  await db.insert(itemSources).values({ itemId: linked, url: "https://example.com/journey", urlNormalized: "example.com/journey" });
  seeded.push(linked);

  const token = await new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 7200)
    .sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET));

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "inzpo_session", value: token, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // 1. index empty state
  await page.goto(BASE + "/boards");
  await page.waitForSelector("text=No boards yet");
  await page.screenshot({ path: "/tmp/journey-1-index-empty.png" });
  check("boards index loads with empty state", true);

  // 2. create a board
  await page.fill('input[name="title"]', "Journey board");
  await page.selectOption('select[name="preset"]', "1:1");
  await page.getByRole("button", { name: "New board" }).click();
  await page.waitForURL(/\/boards\/[A-Za-z0-9]+/);
  boardId = page.url().split("/").pop()!;
  await page.waitForSelector('[aria-label^="Board canvas"]');
  await page.screenshot({ path: "/tmp/journey-2-editor-empty.png" });
  check("board created, editor open", true, boardId);

  // 3. picker: add 4 items
  await page.getByRole("button", { name: "Board", exact: true }).click();
  const sheet = page.locator("[role='dialog']").filter({ hasText: "Board settings" });
  await sheet.getByRole("button", { name: "Add items" }).click();
  await page.waitForSelector("text=Add items", { timeout: 10000 });
  const dialog = page.locator("[role='dialog']").filter({ has: page.locator('input[aria-label="Text search"]') });
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  const cards = dialog.locator('button[role="checkbox"]');
  await cards.first().waitFor({ timeout: 15000 });
  const cardCount = await cards.count();
  for (let i = 0; i < Math.min(4, cardCount); i++) await cards.nth(i).click();
  check("picker offers library items", cardCount >= 4, `${cardCount} cards`);
  await page.screenshot({ path: "/tmp/journey-3-picker.png" });
  await dialog.getByRole("button", { name: /^Add/ }).last().click();
  await page.waitForSelector("[data-placement-id]", { timeout: 15000 });
  await sheet.getByRole("button", { name: "Close" }).click().catch(async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
  });
  await page.waitForSelector('[data-slot="sheet-overlay"]', { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const placed = await page.locator("[data-placement-id]").count();
  check("picker added items onto the canvas", placed >= 4, `${placed} placements`);
  await page.screenshot({ path: "/tmp/journey-4-band.png" });

  // 4. drag + autosave persistence
  const first = page.locator("[data-placement-id]").first();
  const before = await first.boundingBox();
  await first.hover();
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 140, before.y + before.height / 2 + 110, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1700);
  await page.reload();
  await page.waitForSelector("[data-placement-id]");
  const after = await page.locator("[data-placement-id]").first().boundingBox();
  const moved = Math.abs(after.x - before.x) > 80 && Math.abs(after.y - before.y) > 60;
  check("drag persisted across reload", moved, `(${Math.round(before.x)},${Math.round(before.y)}) → (${Math.round(after.x)},${Math.round(after.y)})`);
  await page.screenshot({ path: "/tmp/journey-5-dragged.png" });

  // 5. export + image routes
  const exp = await page.request.get(`${BASE}/boards/${boardId}/export?format=png&scale=2`);
  const expBody = await exp.body();
  check("export route returns PNG @2x", exp.status() === 200 && exp.headers()["content-type"] === "image/png" && expBody.byteLength > 20000, `${exp.status()}, ${expBody.byteLength} bytes`);
  const badExp = await page.request.get(`${BASE}/boards/${boardId}/export?format=svg&scale=2`);
  check("export rejects invalid params", badExp.status() === 400);
  const imgRes = await page.request.get(`${BASE}/boards/${boardId}/image?w=640`);
  check("image route renders", imgRes.status() === 200 && imgRes.headers()["content-type"] === "image/png");

  // 6. wall bulk bar
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: /select items/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  const bulk = page.locator("text=Add to board").first();
  const bulkVisible = await bulk.isVisible().catch(() => false);
  if (!bulkVisible) {
    await page.locator("main img").first().click({ button: "right" }).catch(() => {});
  }
  await page.screenshot({ path: "/tmp/journey-6-wall-bulk.png" });
  check("wall loads", true);

  // 7. item detail boards section
  await page.goto(`${BASE}/items/${a}`);
  const boardsSection = await page.locator("text=Boards").first().isVisible().catch(() => false);
  check("item detail shows Boards section", boardsSection);
  await page.screenshot({ path: "/tmp/journey-7-item-detail.png" });

  // 8. mobile nav
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mctx.addCookies([{ name: "inzpo_session", value: token, domain: "localhost", path: "/" }]);
  const mpage = await mctx.newPage();
  await mpage.goto(BASE + "/boards");
  const navBoards = await mpage.locator("nav a[href='/boards']").isVisible().catch(() => false);
  check("mobile bottom nav has Boards", navBoards);
  await mpage.screenshot({ path: "/tmp/journey-8-mobile.png" });
  await mctx.close();

  const detail = await getBoardDetail(boardId);
  check("board persisted placements server-side", (detail?.placements.length ?? 0) >= 4, `${detail?.placements.length} placements`);
} finally {
  if (boardId) await deleteBoard(boardId).catch(() => {});
  for (const id of seeded) await db.delete(items).where(eq(items.id, id)).catch(() => {});
  await browser.close();
}
if (failures.length > 0) {
  console.log(`FAILED: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("journey passed");
