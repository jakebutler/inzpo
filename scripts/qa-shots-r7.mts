/**
 * r7_ stills against an immutable Preview URL. Live product only (/dev 404s on Preview).
 * Login, capture, real JPEG uploads, reveal frames, result, 404, wall, no-op pin drag.
 *
 *   QA_BASE=<immutable-url> npx tsx scripts/qa-shots-r7.mts
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit, type BrowserContext, type Page } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";
import { BAND_STAGGER_S, INK, PAPER, VERMILION } from "../lib/brand.ts";
import { captureGuardIssues, cssRgbToHex } from "../lib/qa-capture-guard.ts";

const ARTIFACTS = "/opt/cursor/artifacts";
const BASE = (process.env.QA_BASE ?? "").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL ?? "inzpo+clerk_test@example.com";
const CODE = process.env.E2E_CODE ?? "424242";
const PHOTOS = [
  { id: "IMG_6505", file: path.join(process.cwd(), "public/sample/IMG_6505.jpg") },
  { id: "IMG_6208", file: path.join(process.cwd(), "public/sample/IMG_6208.jpg") },
  { id: "IMG_5859", file: path.join(process.cwd(), "public/sample/IMG_5859.jpg") },
] as const;
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
] as const;

if (!BASE) {
  console.error("QA_BASE is required");
  process.exit(1);
}

const GUARD = { pass: 0, fail: 0 };
const PAGE_STATIC_FAILS = new WeakMap<Page, string[]>();
const PAGE_DOC_STATUS = new WeakMap<Page, number>();
const E2E: string[] = [];
const TIMINGS: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  const line = `${ok ? "pass" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`;
  E2E.push(line);
  console.log(line);
}

function watchStatic(page: Page): void {
  if (PAGE_STATIC_FAILS.has(page)) return;
  const fails: string[] = [];
  PAGE_STATIC_FAILS.set(page, fails);
  page.on("response", (res) => {
    const url = res.url();
    const type = res.request().resourceType();
    if (type === "document") PAGE_DOC_STATUS.set(page, res.status());
    if (url.includes("/_next/static") || type === "stylesheet") {
      if (res.status() !== 200) fails.push(`${res.status()} ${url}`);
    }
  });
}

async function hideChrome(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function assertCaptureReady(page: Page, opts?: { allowStatus?: number[] }): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const raw = await page.evaluate(() => {
    const sheets = [...document.styleSheets];
    let ruleCount = 0;
    for (const sheet of sheets) {
      try {
        ruleCount += sheet.cssRules.length;
      } catch {
        // cross-origin
      }
    }
    const wear = document.querySelector("[data-kit-wear]");
    const node = wear ?? document.body;
    const families = [...document.fonts].map((f) => f.family);
    return {
      sheetCount: sheets.length,
      ruleCount,
      backgroundColor: getComputedStyle(node).backgroundColor,
      kitWear: Boolean(wear),
      errorDocument: document.documentElement.id === "__next_error__",
      fraunces: document.fonts.check("18px Fraunces") || families.some((f) => /fraunces/i.test(f)),
      geist: document.fonts.check("16px Geist") || families.some((f) => /geist/i.test(f) && !/mono/i.test(f)),
    };
  });
  const allowed = opts?.allowStatus ?? [200];
  const status = PAGE_DOC_STATUS.get(page);
  const issues = captureGuardIssues({
    staticFails: PAGE_STATIC_FAILS.get(page) ?? [],
    sheetCount: raw.sheetCount,
    ruleCount: raw.ruleCount,
    backgroundHex: cssRgbToHex(raw.backgroundColor),
    kitWear: raw.kitWear,
    fraunces: raw.fraunces,
    geist: raw.geist,
    documentStatus: status !== undefined && allowed.includes(status) ? 200 : status,
    errorDocument: raw.errorDocument,
  });
  if (issues.length > 0) {
    GUARD.fail += 1;
    throw new Error(`capture guard failed:\n${issues.join("\n")}`);
  }
  GUARD.pass += 1;
}

async function shot(
  page: Page,
  dest: string,
  opts?: { waitMs?: number; reduced?: boolean; allowStatus?: number[]; skipGuard?: boolean },
): Promise<void> {
  await hideChrome(page);
  if (!opts?.skipGuard) await assertCaptureReady(page, { allowStatus: opts?.allowStatus });
  await page.waitForTimeout(opts?.waitMs ?? 400);
  await page.screenshot({
    path: dest,
    animations: opts?.reduced ? "disabled" : "allow",
  });
}

async function waitForClerk(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded),
    { timeout: 20_000 },
  );
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 60_000 });
  await page.locator("#email").waitFor({ timeout: 20_000 });
  await waitForClerk(page);
  await page.fill("#email", EMAIL);
  await page.locator('button[type="submit"]').click();
  await page.locator("#code").waitFor({ timeout: 25_000 });
  await shot(page, path.join(ARTIFACTS, "r7_login_code_390x844_motion.png"), { waitMs: 300 });
  await page.fill("#code", CODE);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(/\/capture/, { timeout: 20_000 });
  } catch {
    await page.goto(`${BASE}/capture`, { waitUntil: "load", timeout: 60_000 });
  }
  if (!/\/capture/.test(page.url())) {
    throw new Error(`signed in but landed on ${page.url()}`);
  }
}

async function captureRevealFrames(page: Page, url: string, photoId: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("[data-photo-fold]").waitFor({ timeout: 15_000 });
  const marks = [0, 100, 300, 600] as const;
  const start = Date.now();
  for (const ms of marks) {
    const wait = ms - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({
      path: path.join(ARTIFACTS, `r7_${photoId}_390x844_reveal${ms}ms.png`),
      animations: "allow",
    });
  }
  await assertCaptureReady(page);
}

async function briefReadyMs(page: Page): Promise<number | null> {
  const start = Date.now();
  try {
    await page.waitForFunction(
      () => {
        const text = document.querySelector("[data-brief-text]")?.textContent?.trim() ?? "";
        if (text.length === 0) return false;
        return !/chewing on it/i.test(text);
      },
      { timeout: 30_000 },
    );
    return Date.now() - start;
  } catch {
    return null;
  }
}

async function noopPinDrag(page: Page): Promise<{ before: string | null; after: string | null; saved: boolean }> {
  const band = page.locator('[data-role="primary"]').first();
  await band.waitFor({ timeout: 10_000 });
  const before = await band.getAttribute("aria-label");
  await band.click();
  const pin = page.locator('[data-pin="primary"]').first();
  const box = (await pin.boundingBox()) ?? (await page.locator("[data-photo-fold] img").first().boundingBox());
  if (!box) return { before, after: before, saved: false };
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "load" });
  const after = await page.locator('[data-role="primary"]').first().getAttribute("aria-label");
  return { before, after, saved: before === after };
}

async function main(): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  const motionTxt = [
    `tap ${MOTION.tap.duration}s ${MOTION.tap.ease} (${MOTION_CSS.tapMs}ms)`,
    `enter ${MOTION.enter.duration}s ${MOTION.enter.ease} (${MOTION_CSS.enterMs}ms)`,
    `band stagger ${BAND_STAGGER_S}s × 6 + enter ${MOTION.enter.duration}s`,
    `paper ${PAPER} ink ${INK} vermilion ${VERMILION}`,
    `qa base ${BASE}`,
  ].join("\n") + "\n";
  await writeFile(path.join(ARTIFACTS, "r7_motion.txt"), motionTxt);

  const browser = await webkit.launch();
  const itemUrls: Record<string, string> = {};
  const mediaCodes: Record<string, number | string> = {};

  for (const reduced of [false, true]) {
    const label = reduced ? "reduced" : "motion";
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      watchStatic(page);

      await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 60_000 });
      await shot(page, path.join(ARTIFACTS, `r7_login_empty_${vp.name}_${label}.png`), {
        waitMs: reduced ? 200 : 500,
        reduced,
      });

      await page.fill("#email", EMAIL);
      await shot(page, path.join(ARTIFACTS, `r7_login_typed_${vp.name}_${label}.png`), {
        waitMs: reduced ? 160 : 300,
        reduced,
      });

      await page.goto(`${BASE}/login?error=captcha_invalid`, { waitUntil: "load", timeout: 60_000 });
      await shot(page, path.join(ARTIFACTS, `r7_login_captcha_${vp.name}_${label}.png`), {
        waitMs: reduced ? 160 : 300,
        reduced,
      });

      await page.close();
    }
  }

  const auth = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "no-preference",
  });
  const live = await auth.newPage();
  watchStatic(live);

  try {
    await signIn(live);
    check("signed in", /\/capture/.test(live.url()) || live.url() === `${BASE}/` || live.url() === `${BASE}/`, live.url());
  } catch (err) {
    check("signed in", false, err instanceof Error ? err.message : String(err));
    await live.screenshot({ path: path.join(ARTIFACTS, "r7_login_signin_failed.png") });
    throw err;
  }

  await live.goto(`${BASE}/capture`, { waitUntil: "load", timeout: 60_000 });
  await shot(live, path.join(ARTIFACTS, "r7_capture_empty_390x844_motion.png"), { waitMs: 400 });

  for (const photo of PHOTOS) {
    await live.goto(`${BASE}/capture`, { waitUntil: "load", timeout: 60_000 });
    await live.locator('button:has-text("Pick a photo")').waitFor();
    const input = live.locator('input[type="file"][accept*="heic"]').first();
    const nav = live.waitForURL(/\/items\//, { timeout: 90_000 });
    const t0 = Date.now();
    await input.setInputFiles(photo.file);
    await live
      .locator("[data-upload-wait]")
      .first()
      .waitFor({ timeout: 8_000 })
      .catch(() => undefined);
    await live
      .screenshot({
        path: path.join(ARTIFACTS, `r7_${photo.id}_390x844_chewing_motion.png`),
        animations: "allow",
      })
      .catch(() => undefined);
    try {
      await nav;
      const uploadMs = Date.now() - t0;
      check(`${photo.id} reached result`, true, `${live.url()} ${uploadMs}ms`);
      itemUrls[photo.id] = live.url();
      TIMINGS.push(`${photo.id} upload+save ${uploadMs}ms`);
      await shot(live, path.join(ARTIFACTS, `r7_${photo.id}_390x844_result_motion.png`), { waitMs: 800 });
      const briefMs = await briefReadyMs(live);
      TIMINGS.push(`${photo.id} brief ${briefMs ?? "timeout"}ms`);
      const src = await live.locator("[data-photo-fold] img").last().getAttribute("src");
      if (src?.startsWith("/media/")) {
        const res = await live.request.get(new URL(src, BASE).toString());
        mediaCodes[photo.id] = res.status();
        check(`${photo.id} media`, res.status() === 200, String(res.status()));
      } else {
        mediaCodes[photo.id] = src ?? "missing";
        check(`${photo.id} media`, false, src ?? "no src");
      }
      const alt = await live.locator("[data-photo-fold] img").last().getAttribute("alt");
      check(`${photo.id} photo alt named`, Boolean(alt && alt !== "Photo" && !/untitled/i.test(alt)), alt ?? "");
    } catch (err) {
      check(`${photo.id} reached result`, false, err instanceof Error ? err.message : String(err));
      mediaCodes[photo.id] = "error";
      await live.screenshot({ path: path.join(ARTIFACTS, `r7_${photo.id}_390x844_upload_failed.png`) });
    }
  }

  const firstUrl = itemUrls.IMG_6505 ?? Object.values(itemUrls)[0];
  if (firstUrl) {
    try {
      await captureRevealFrames(live, firstUrl, "IMG_6505");
      check("reveal frames", true, "0/100/300/600ms");
    } catch (err) {
      check("reveal frames", false, err instanceof Error ? err.message : String(err));
    }
    try {
      await live.goto(firstUrl, { waitUntil: "load", timeout: 60_000 });
      const drag = await noopPinDrag(live);
      check("noop pin drag", drag.saved, `${drag.before} -> ${drag.after}`);
    } catch (err) {
      check("noop pin drag", false, err instanceof Error ? err.message : String(err));
    }
  }

  await live.goto(`${BASE}/no-such-r7-page`, { waitUntil: "load", timeout: 60_000 });
  await shot(live, path.join(ARTIFACTS, "r7_404_390x844_motion.png"), {
    waitMs: 400,
    allowStatus: [404],
  });

  await live.goto(`${BASE}/`, { waitUntil: "load", timeout: 60_000 });
  await shot(live, path.join(ARTIFACTS, "r7_wall_390x844_motion.png"), { waitMs: 400 });
  const untitledCount = await live.getByText("Untitled kit").count();
  check("wall untitled count", untitledCount === 0, String(untitledCount));

  const statePath = path.join(ARTIFACTS, "r7_storage.json");
  await auth.storageState({ path: statePath });

  for (const reduced of [false, true]) {
    const label = reduced ? "reduced" : "motion";
    for (const vp of VIEWPORTS) {
      if (vp.name === "390x844" && !reduced) continue;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: reduced ? "reduce" : "no-preference",
        storageState: statePath,
      });
      const page = await ctx.newPage();
      watchStatic(page);
      for (const photo of PHOTOS) {
        const url = itemUrls[photo.id];
        if (!url) continue;
        await page.goto(url, { waitUntil: "load", timeout: 60_000 });
        await shot(page, path.join(ARTIFACTS, `r7_${photo.id}_${vp.name}_result_${label}.png`), {
          waitMs: reduced ? 200 : 700,
          reduced,
        });
      }
      await ctx.close();
    }
  }

  {
    const ctx: BrowserContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: "no-preference",
      recordVideo: { dir: ARTIFACTS, size: { width: 390, height: 844 } },
    });
    const page = await ctx.newPage();
    watchStatic(page);
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 60_000 });
    await hideChrome(page);
    await waitForClerk(page);
    await page.waitForTimeout(400);
    await page.fill("#email", EMAIL);
    await page.waitForTimeout(300);
    await page.click('button[type="submit"]');
    await page.locator("#code").waitFor({ timeout: 25_000 });
    await page.waitForTimeout(300);
    await page.fill("#code", CODE);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(/\/capture/, { timeout: 20_000 });
    } catch {
      await page.goto(`${BASE}/capture`, { waitUntil: "load", timeout: 60_000 });
    }
    await page.goto(`${BASE}/capture`, { waitUntil: "load" });
    await hideChrome(page);
    await page.waitForTimeout(400);
    const input = page.locator('input[type="file"][accept*="heic"]').first();
    await input.setInputFiles(PHOTOS[0]!.file);
    await page.waitForURL(/\/items\//, { timeout: 90_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    const video = page.video();
    await page.close();
    await ctx.close();
    if (video) {
      const raw = await video.path();
      const dest = path.join(ARTIFACTS, "r7_flow_motion.webm");
      await copyFile(raw, dest);
    }
  }

  await live.close();
  await auth.close();
  await browser.close();

  const guardLine = `capture guard pass=${GUARD.pass} fail=${GUARD.fail}\n`;
  await writeFile(path.join(ARTIFACTS, "r7_guard.txt"), guardLine);
  await writeFile(
    path.join(ARTIFACTS, "r7_e2e.txt"),
    `${E2E.join("\n")}\nmedia ${JSON.stringify(mediaCodes)}\nitems ${JSON.stringify(itemUrls)}\n${TIMINGS.join("\n")}\n`,
  );
  await writeFile(path.join(ARTIFACTS, "r7_timings.txt"), `${TIMINGS.join("\n")}\n`);
  console.log(guardLine.trim());
  console.log(TIMINGS.join("\n"));
  console.log("r7_ shots written");
  if (E2E.some((line) => line.startsWith("FAIL"))) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
