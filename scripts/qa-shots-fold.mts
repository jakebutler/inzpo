/**
 * r3_ visual-direction stills: real photos, both viewports, reduced off/on.
 * Mid and result are shot from the top of the page so the 337px crop lock can be compared.
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";
import { BAND_H_EDITOR, BAND_H_RESULT, BAND_STAGGER_S, INK, PAPER, PHOTO_FOLD_PX, PIN_HAIRLINE_S, PIN_LEADER_X, VERMILION } from "../lib/brand.ts";

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

async function openShot(
  page: import("playwright").Page,
  url: string,
): Promise<import("playwright").Page> {
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    return page;
  } catch {
    const browser = page.context().browser();
    const vp = page.viewportSize();
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    try {
      await page.close();
    } catch {
      // already gone
    }
    const next = await (browser ?? page.context()).newPage({
      viewport: vp ?? { width: 390, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await next.goto(url, { waitUntil: "load", timeout: 60_000 });
    return next;
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

async function main(): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  const motionTxt = [
    `tap ${MOTION.tap.duration}s ${MOTION.tap.ease} (${MOTION_CSS.tapMs}ms)`,
    `small ${MOTION.small.duration}s ${MOTION.small.ease} (${MOTION_CSS.smallMs}ms)`,
    `enter ${MOTION.enter.duration}s ${MOTION.enter.ease} (${MOTION_CSS.enterMs}ms)`,
    `leave ${MOTION.leave.duration}s ${MOTION.leave.ease} (${MOTION_CSS.leaveMs}ms)`,
    `reduced ${MOTION.reduced.duration}s ${MOTION.reduced.ease} (${MOTION_CSS.reducedMs}ms)`,
    `band stagger ${BAND_STAGGER_S}s × 6 + enter ${MOTION.enter.duration}s = ${BAND_STAGGER_S * 5 + MOTION.enter.duration}s`,
    `pin hairline ${PIN_HAIRLINE_S}s then fade ${MOTION.leave.duration}s`,
    `band height result ${BAND_H_RESULT}px editor ${BAND_H_EDITOR}px`,
    `photo fold ${PHOTO_FOLD_PX}px leader x ${PIN_LEADER_X}px`,
    `paper ${PAPER} ink ${INK} vermilion ${VERMILION}`,
    `fonts Fraunces / Geist / Geist Mono via next/font`,
  ].join("\n") + "\n";
  await writeFile(path.join(ARTIFACTS, "r3_motion.txt"), motionTxt);
  await writeFile(path.join(ARTIFACTS, "motion.txt"), motionTxt);

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
          page = await openShot(page, urlFor(shot, photo));
          await hideChrome(page);
          if (ABOVE_BAR.has(shot.state)) await revealAboveSaveBar(page);
          await page.waitForTimeout(reduced ? 200 : 700);
          const name = `r3_${photo}_${vp.name}_${shot.state}_${label}.png`;
          await page.screenshot({ path: path.join(ARTIFACTS, name), animations: reduced ? "disabled" : "allow" });
        }
      }
      for (const shot of EXTRA) {
        page = await openShot(page, urlFor(shot, shot.photo ?? "IMG_6505"));
        await hideChrome(page);
        if (ABOVE_BAR.has(shot.state)) await revealAboveSaveBar(page);
        await page.waitForTimeout(reduced ? 200 : 700);
        const name = `r3_${shot.photo}_${vp.name}_${shot.state}_${label}.png`;
        await page.screenshot({ path: path.join(ARTIFACTS, name), animations: reduced ? "disabled" : "allow" });
      }
      await page.close();
    }
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
    await page.goto(`${BASE}/dev/fold?state=mid&photo=IMG_6505`, { waitUntil: "load" });
    await hideChrome(page);
    await page.waitForTimeout(reduced ? 200 : 600);
    await page.goto(`${BASE}/dev/fold?state=result&photo=IMG_6505`, { waitUntil: "load" });
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
      const dest = path.join(ARTIFACTS, `r3_flow_${label}.webm`);
      await copyFile(raw, dest);
      await writeFile(path.join(ARTIFACTS, `r3_flow_${label}_path.txt`), `${dest}\n`);
    }
  }

  await browser.close();
  console.log("r3_ fold shots written");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
