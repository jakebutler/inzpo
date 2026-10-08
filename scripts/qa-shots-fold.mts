/**
 * r4_ visual-direction stills: real photos, both viewports, reduced off/on.
 * Extra: 200ms into the reveal on IMG_5859 at 390x844 motion-on.
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";
import {
  BAND_H_EDITOR,
  BAND_H_RESULT,
  BAND_STAGGER_S,
  INK,
  PAPER,
  PHOTO_FOLD_CSS,
  PHOTO_FOLD_PX,
  PIN_HAIRLINE_S,
  PIN_LEADER_X,
  PIN_SIZE,
  VERMILION,
} from "../lib/brand.ts";
import { FOLD_BRIEFS } from "../lib/fold-briefs.ts";
import { BAKU_CROSSFADE_MS } from "../lib/baku-v6.ts";

const ARTIFACTS = "/opt/cursor/artifacts";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const PHOTOS = ["IMG_6505", "IMG_6208", "IMG_5859"] as const;
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
] as const;

type Shot = { state: string; photo?: string };

const PER_PHOTO: Shot[] = [
  { state: "first" },
  { state: "result" },
  { state: "mid" },
  { state: "pending" },
  { state: "chips" },
  { state: "edit" },
  { state: "save" },
  { state: "saved" },
];

const EXTRA: Shot[] = [
  { state: "collection", photo: "IMG_6505" },
  { state: "empty-collection", photo: "IMG_6505" },
  { state: "empty-roles", photo: "IMG_6208" },
  { state: "dark", photo: "IMG_6208" },
];

function urlFor(shot: Shot, photo: string): string {
  const p = shot.photo ?? photo;
  return `${BASE}/dev/fold?state=${shot.state}&photo=${p}`;
}

const ABOVE_BAR = new Set(["pending", "chips", "saved", "empty-roles", "dark"]);

async function hideChrome(page: import("playwright").Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function recoverPage(
  page: import("playwright").Page,
  reduced: boolean,
): Promise<import("playwright").Page> {
  const browser = page.context().browser();
  const vp = page.viewportSize();
  try {
    await page.close();
  } catch {
    // already gone
  }
  return (browser ?? page.context()).newPage({
    viewport: vp ?? { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
}

async function openShot(
  page: import("playwright").Page,
  url: string,
  reduced: boolean,
): Promise<import("playwright").Page> {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    return page;
  } catch {
    const next = await recoverPage(page, reduced);
    await next.goto(url, { waitUntil: "load", timeout: 60_000 });
    return next;
  }
}

async function captureShot(
  page: import("playwright").Page,
  url: string,
  dest: string,
  reduced: boolean,
  waitMs: number,
  aboveBar: boolean,
): Promise<import("playwright").Page> {
  let current = await openShot(page, url, reduced);
  await hideChrome(current);
  if (aboveBar) await revealAboveSaveBar(current);
  try {
    await current.waitForTimeout(waitMs);
    await current.screenshot({ path: dest, animations: reduced ? "disabled" : "allow" });
    return current;
  } catch {
    current = await openShot(await recoverPage(current, reduced), url, reduced);
    await hideChrome(current);
    if (aboveBar) await revealAboveSaveBar(current);
    await current.waitForTimeout(Math.min(waitMs, 400));
    await current.screenshot({ path: dest, animations: reduced ? "disabled" : "allow" });
    return current;
  }
}

/** Scroll so Baku, chips, and the contrast line sit above the fixed save bar. */
async function revealAboveSaveBar(page: import("playwright").Page): Promise<void> {
  await page.evaluate(() => {
    const bar = document.querySelector("[data-save-bar]");
    const candidates = [
      document.querySelector("[data-named-chip]"),
      document.querySelector('[aria-label="Brief"]'),
      document.querySelector("[data-contrast-line]"),
    ].filter((el): el is Element => el !== null);
    if (!bar || candidates.length === 0) return;
    const fade = 48;
    const gap = 12;
    const limit = window.innerHeight - bar.getBoundingClientRect().height - fade - gap;
    const bottom = Math.max(...candidates.map((el) => el.getBoundingClientRect().bottom));
    const need = bottom - limit;
    if (need > 0) window.scrollBy(0, need);
  });
}

function motionTxt(): string {
  return (
    [
      `tap ${MOTION.tap.duration}s ${MOTION.tap.ease} (${MOTION_CSS.tapMs}ms)`,
      `small ${MOTION.small.duration}s ${MOTION.small.ease} (${MOTION_CSS.smallMs}ms)`,
      `enter ${MOTION.enter.duration}s ${MOTION.enter.ease} (${MOTION_CSS.enterMs}ms)`,
      `leave ${MOTION.leave.duration}s ${MOTION.leave.ease} (${MOTION_CSS.leaveMs}ms)`,
      `reduced ${MOTION.reduced.duration}s ${MOTION.reduced.ease} (${MOTION_CSS.reducedMs}ms)`,
      `band stagger ${BAND_STAGGER_S}s × 6 + enter ${MOTION.enter.duration}s = ${BAND_STAGGER_S * 5 + MOTION.enter.duration}s`,
      `pin hairline ${PIN_HAIRLINE_S}s then fade ${MOTION.leave.duration}s`,
      `band height result ${BAND_H_RESULT}px editor ${BAND_H_EDITOR}px`,
      `photo fold ${PHOTO_FOLD_CSS} (max ${PHOTO_FOLD_PX}px) leader x ${PIN_LEADER_X}px pin ${PIN_SIZE}px`,
      `baku v6 crossfade ${BAKU_CROSSFADE_MS}ms`,
      `paper ${PAPER} ink ${INK} vermilion ${VERMILION}`,
      `fonts Fraunces / Geist / Geist Mono via next/font`,
      `brief model ${FOLD_BRIEFS.IMG_6505.model}`,
      `IMG_6505 brief latency ${FOLD_BRIEFS.IMG_6505.latencyMs ?? "n/a"}ms`,
      `IMG_6208 brief latency ${FOLD_BRIEFS.IMG_6208.latencyMs ?? "n/a"}ms`,
      `IMG_6505 brief ${JSON.stringify(FOLD_BRIEFS.IMG_6505.text)}`,
      `IMG_6208 brief ${JSON.stringify(FOLD_BRIEFS.IMG_6208.text)}`,
    ].join("\n") + "\n"
  );
}

async function main(): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  const txt = motionTxt();
  await writeFile(path.join(ARTIFACTS, "r4_motion.txt"), txt);
  await writeFile(path.join(ARTIFACTS, "motion.txt"), txt);

  const browser = await webkit.launch();
  for (const reduced of [false, true]) {
    const label = reduced ? "reduced" : "motion";
    for (const vp of VIEWPORTS) {
      let page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      for (const photo of PHOTOS) {
        for (const shot of PER_PHOTO) {
          const name = `r4_${photo}_${vp.name}_${shot.state}_${label}.png`;
          page = await captureShot(
            page,
            urlFor(shot, photo),
            path.join(ARTIFACTS, name),
            reduced,
            reduced ? 200 : 700,
            ABOVE_BAR.has(shot.state),
          );
        }
      }
      for (const shot of EXTRA) {
        const name = `r4_${shot.photo}_${vp.name}_${shot.state}_${label}.png`;
        page = await captureShot(
          page,
          urlFor(shot, shot.photo ?? "IMG_6505"),
          path.join(ARTIFACTS, name),
          reduced,
          reduced ? 200 : 700,
          ABOVE_BAR.has(shot.state),
        );
      }
      await page.close();
    }
  }

  {
    let page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: "no-preference",
    });
    page = await captureShot(
      page,
      `${BASE}/dev/fold?state=result&photo=IMG_5859&play=1`,
      path.join(ARTIFACTS, "r4_IMG_5859_390x844_reveal200ms_motion.png"),
      false,
      200,
      false,
    );
    await page.close();
  }

  for (const reduced of [false, true]) {
    const label = reduced ? "reduced" : "motion";
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: reduced ? "reduce" : "no-preference",
      recordVideo: { dir: ARTIFACTS, size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/dev/fold?state=first&photo=IMG_6505`, { waitUntil: "load", timeout: 60_000 });
    await hideChrome(page);
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/dev/fold?state=result&photo=IMG_6505&play=1`, { waitUntil: "load" });
    await hideChrome(page);
    await page.waitForTimeout(reduced ? 200 : 900);
    await page.goto(`${BASE}/dev/fold?state=edit&photo=IMG_6505`, { waitUntil: "load" });
    await hideChrome(page);
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/dev/fold?state=save&photo=IMG_6505`, { waitUntil: "load" });
    await hideChrome(page);
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/dev/fold?state=saved&photo=IMG_6505`, { waitUntil: "load" });
    await hideChrome(page);
    await page.waitForTimeout(500);
    const video = page.video();
    await page.close();
    await context.close();
    if (video) {
      const raw = await video.path();
      const dest = path.join(ARTIFACTS, `r4_flow_${label}.webm`);
      await copyFile(raw, dest);
      await writeFile(path.join(ARTIFACTS, `r4_flow_${label}_path.txt`), `${dest}\n`);
    }
  }

  await browser.close();
  console.log("r4_ fold shots written");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
