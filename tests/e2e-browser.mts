import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = process.env.E2E_BASE ?? "https://inzpo-butlerjake-gmailcoms-projects.vercel.app";
const PASS = process.env.AUTH_PASSPHRASE!;

const failures: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: { r: 40, g: 90, b: 200 } } })
  .png()
  .toBuffer();
const tmp = path.join("/tmp", `inzpo-e2e-${crypto.randomUUID()}.png`);
fs.writeFileSync(tmp, png);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

try {
  // 1. gate
  await page.goto(BASE + "/");
  await page.waitForURL(/\/login/);
  check("gate redirects to /login", true);

  // 2. wrong passphrase
  await page.fill('input[name="passphrase"]', "wrong-passphrase");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Incorrect passphrase.", { timeout: 15000 });
  check("wrong passphrase shows generic error", true);

  // 3. login
  await page.fill('input[name="passphrase"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
  check("correct passphrase reaches the Wall", true);

  // 4. prominent capture entry (mobile bottom nav center button)
  const fab = page.locator('a[aria-label="Capture"]');
  check("capture FAB is prominent on mobile", await fab.isVisible());

  // 5. photo capture: file only — tray must NOT be present before substance
  await fab.click();
  await page.waitForURL(/\/capture/);
  const trayBefore = (await page.locator('legend:has-text("Style")').count()) > 0;
  check("no tag tray before substance", !trayBefore);
  await page.setInputFiles('input[type="file"]', tmp);
  await page.waitForSelector('legend:has-text("Style")', { timeout: 15000 });
  check("tray animates in after substance", true);
  check("relevant facet (Complexity) surfaces for photo", (await page.locator('legend:has-text("Complexity")').count()) > 0);

  // tag via Style: minimal chip, then save
  await page.locator('fieldset', { has: page.locator('legend', { hasText: 'Style' }) }).first().locator('button:has-text("minimal")').first().click();
  await page.click('button[type="submit"]:has-text("Save")');
  await page.waitForURL(/\/capture\?saved=/, { timeout: 30000 });
  check("photo capture re-arms with toast", true);
  await page.waitForSelector("text=Saved", { timeout: 6000 });
  check("capture toast fires", true);

  // 6. View item → detail
  await page.click("text=View item");
  await page.waitForURL(/\/items\//);
  const detailUrl = page.url();
  check("View item opens the detail view", true);
  check("detail shows kind Photo", await page.locator("text=Photo").first().isVisible());
  check("detail shows colors section", await page.locator("text=Colors").first().isVisible());

  // 7. wall card + media proxy + tag chip
  await page.goto(BASE + "/");
  await page.waitForSelector('figcaption:has-text("minimal")', { timeout: 15000 });
  check("card on wall tagged minimal", true);
  const imgOk = await page
    .waitForFunction(
      () => {
        const img = document.querySelector<HTMLImageElement>("figure img");
        return !!img && img.complete && img.naturalWidth > 0;
      },
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false);
  check("media proxy serves the image in-browser", imgOk);

  // 8. filter sheet: tri-state via Style minimal, live count
  await page.click('button:has-text("Filters")');
  await page.waitForSelector('h3:has-text("Kind")', { timeout: 15000 });
  const styleGroup = page.locator("section", { has: page.locator("h3", { hasText: "Style" }) }).first();
  await styleGroup.locator('button:has-text("minimal")').first().click();
  await page.waitForTimeout(1200);
  const doneText = await page.locator('button:has-text("Done")').innerText();
  check("sheet live count > 0", /Done — [1-9]/.test(doneText), doneText.trim());
  await page.click('button:has-text("Done")');
  check("chip row shows the selection", await page.locator("div.sticky button:has-text('minimal')").first().isVisible());

  // 9. text search → empty state
  await page.fill('input[aria-label="Text search"]', "zzz-no-match");
  await page.waitForSelector("text=Nothing matches.", { timeout: 15000 });
  check("text search resolves to zero", true);
  await page.fill('input[aria-label="Text search"]', "");

  // 10. edit mode rename
  await page.goto(detailUrl);
  await page.click("a:has-text('✎ Edit')");
  await page.waitForURL(/\/edit/);
  await page.fill("#title", "E2E renamed item");
  await page.click('button:has-text("Done")');
  await page.waitForURL(detailUrl);
  check("edit saves new title", await page.locator("text=E2E renamed item").first().isVisible());

  // 11. URL capture: preview + auto tag animates in
  await page.goto(BASE + "/capture");
  await page.fill('input[name="url"]', "https://www.joshwcomeau.com/animation/css-transitions/");
  await page.waitForSelector('span:has-text("Article · detected")', { timeout: 30000 });
  check("URL preview card shows auto-detected kind", true);
  await page.waitForSelector('span:text-is("auto")', { timeout: 15000 });
  check("auto-selected tag marker animates in", true);
  await page.click('button[type="submit"]:has-text("Save")');
  await page.waitForURL(/\/capture\?saved=/, { timeout: 30000 });
  check("URL capture works", true);

  // 12. duplicate notice: capture example.com first, then a dressed variant
  await page.goto(BASE + "/capture");
  await page.fill('input[name="url"]', "https://example.com/");
  await page.click('button[type="submit"]:has-text("Save")');
  await page.waitForURL(/\/capture\?saved=/, { timeout: 30000 });
  await page.goto(BASE + "/capture");
  await page.fill('input[name="url"]', "https://example.com/?utm_source=e2e#top");
  await page.waitForSelector("text=Already saved", { timeout: 15000 });
  check("duplicate notice appears", true);
  check("notice still allows Save (non-blocking)", (await page.locator('button[type="submit"]:has-text("Save")').count()) === 1);

  // 13. selection mode toggle
  await page.goto(BASE + "/");
  await page.click('button[aria-label="Select"] >> nth=0');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Exit selection")');
  check("selection mode toggles", true);

  // 14. hard delete the renamed item
  await page.goto(detailUrl);
  await page.click('button:has-text("Delete…")');
  await page.click('form button[type="submit"]:has-text("Delete")');
  await page.waitForURL(`${BASE}/`);
  check("hard delete returns to wall", true);
} catch (err) {
  check("UNEXPECTED FAILURE", false, String(err).slice(0, 300));
  await page.screenshot({ path: "/tmp/inzpo-e2e-failure.png" }).catch(() => {});
  console.log("screenshot: /tmp/inzpo-e2e-failure.png");
} finally {
  fs.rmSync(tmp, { force: true });
  await browser.close();
}

// self-cleanup: remove everything this run created
try {
  const { deleteItem } = await import("../lib/items");
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const leaked = await db.execute(
    sql`select id from items where title like 'inzpo e2e%' or id in (select item_id from item_sources where url_normalized in ('https://example.com', 'https://www.joshwcomeau.com/animation/css-transitions/'))`,
  );
  for (const row of leaked.rows as Array<{ id: string }>) await deleteItem(row.id);
  console.log(`self-cleanup removed ${(leaked.rows as unknown[]).length} item(s)`);
} catch (e) {
  console.log("cleanup warning:", String(e).slice(0, 120));
}

if (failures.length > 0) {
  console.log(`\nFAILED (${failures.length}): ${failures.join(" | ")}`);
  process.exit(1);
}
console.log("\nBROWSER E2E PASSES");
