import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = "https://inzpo-butlerjake-gmailcoms-projects.vercel.app";
const { createImageItem } = await import("../lib/items");

const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 200, b: 0 } } }).png().toBuffer();
const id = await createImageItem({ buffer: png, filename: "delete-debug.png" });
console.log("created:", id);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.setDefaultTimeout(15000);
page.on("response", (r) => { if (r.url().includes("/items/")) console.log("resp:", r.status(), r.request().method()); });

await page.goto(BASE + "/login");
await page.fill('input[name="passphrase"]', process.env.AUTH_PASSPHRASE!);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`);
await page.goto(`${BASE}/items/${id}`);
await page.click('button:has-text("Delete…")');
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/delete-dialog.png" });
await page.click('form button[type="submit"]:has-text("Delete")');
await page.waitForURL(`${BASE}/`, { timeout: 15000 });
await page.waitForTimeout(800);
const { getItemDetail } = await import("../lib/items");
const still = await getItemDetail(id);
console.log("item exists after UI delete:", still ? "YES — BUG" : "no ✓");
await browser.close();
if (still) {
  await deleteItem(id);
  console.log("manually removed");
}
process.exit(0);
async function deleteItem(itemId: string) {
  const { deleteItem: del } = await import("../lib/items");
  await del(itemId);
}
