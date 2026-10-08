/**
 * Live Preview e2e: sign in as the Clerk test user, upload a real JPEG,
 * land on the kit result, and confirm /media returns 200.
 * No test shims. Run against the immutable Preview URL after deploy.
 *
 *   E2E_BASE=<immutable-url> npx tsx tests/e2e-upload-preview.mts
 */
import { webkit } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = (process.env.E2E_BASE ?? "").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL ?? "inzpo+clerk_test@example.com";
const CODE = process.env.E2E_CODE ?? "424242";
const PHOTOS = (process.env.E2E_PHOTOS ?? "public/sample/IMG_6505.jpg,public/sample/IMG_6208.jpg,public/sample/IMG_5859.jpg")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

if (!BASE) {
  console.error("E2E_BASE is required");
  process.exit(1);
}

const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function signIn(page: import("playwright").Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("#email");
  await page.fill("#email", EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#code", { timeout: 20000 });
  await page.fill("#code", CODE);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(capture|$)/, { timeout: 25000 });
}

const jpeg = await sharp({
  create: { width: 800, height: 600, channels: 3, background: { r: 210, g: 160, b: 70 } },
})
  .jpeg({ quality: 88 })
  .toBuffer();
const tmp = path.join(os.tmpdir(), `inzpo-e2e-${Date.now()}.jpg`);
fs.writeFileSync(tmp, jpeg);

const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.setDefaultTimeout(40000);

try {
  await signIn(page);
  check("signed in", /\/capture/.test(page.url()) || page.url() === `${BASE}/` || page.url() === `${BASE}`);

  const files = PHOTOS.filter((p) => fs.existsSync(p));
  const toUpload = files.length > 0 ? files : [tmp];
  for (const file of toUpload) {
    await page.goto(`${BASE}/capture`);
    await page.waitForSelector('button:has-text("Pick a photo")');
    const input = page.locator('input[type="file"][accept*="heic"]').first();
    await input.setInputFiles(file);
    await page.waitForURL(/\/items\//, { timeout: 90000 });
    const itemUrl = page.url();
    check(`${path.basename(file)} reached result`, /\/items\//.test(itemUrl), itemUrl);
    const img = page.locator("[data-photo-fold] img").first();
    await img.waitFor({ timeout: 20000 });
    const src = await img.getAttribute("src");
    check(`${path.basename(file)} has media src`, !!src && src.startsWith("/media/"), src ?? "");
    if (src) {
      const res = await page.request.get(new URL(src, BASE).toString());
      check(`${path.basename(file)} media ${res.status()}`, res.status() === 200, String(res.status()));
    }
  }
} catch (err) {
  check("e2e threw", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
  fs.unlinkSync(tmp);
}

if (failures.length > 0) {
  console.error(`FAILED: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("e2e upload preview passed");
