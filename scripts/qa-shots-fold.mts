/**
 * r2_ visual-direction stills: real photos, both viewports, reduced off/on.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";
import { BAND_H_EDITOR, BAND_H_RESULT, BAND_STAGGER_S, INK, PAPER, PIN_HAIRLINE_S, VERMILION } from "../lib/brand.ts";

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
  { state: "empty-roles", photo: "IMG_6208" },
  { state: "dark", photo: "IMG_6208" },
];

function urlFor(shot: Shot, photo: string): string {
  const p = shot.photo ?? photo;
  return `${BASE}/dev/fold?state=${shot.state}&photo=${p}`;
}

async function hideChrome(page: import("playwright").Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function main(): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  await writeFile(
    path.join(ARTIFACTS, "r2_motion.txt"),
    [
      `tap ${MOTION.tap.duration}s ${MOTION.tap.ease} (${MOTION_CSS.tapMs}ms)`,
      `small ${MOTION.small.duration}s ${MOTION.small.ease} (${MOTION_CSS.smallMs}ms)`,
      `enter ${MOTION.enter.duration}s ${MOTION.enter.ease} (${MOTION_CSS.enterMs}ms)`,
      `leave ${MOTION.leave.duration}s ${MOTION.leave.ease} (${MOTION_CSS.leaveMs}ms)`,
      `reduced ${MOTION.reduced.duration}s ${MOTION.reduced.ease} (${MOTION_CSS.reducedMs}ms)`,
      `band stagger ${BAND_STAGGER_S}s × 6 + enter ${MOTION.enter.duration}s = ${BAND_STAGGER_S * 5 + MOTION.enter.duration}s`,
      `pin hairline ${PIN_HAIRLINE_S}s then fade ${MOTION.leave.duration}s`,
      `band height result ${BAND_H_RESULT}px editor ${BAND_H_EDITOR}px`,
      `paper ${PAPER} ink ${INK} vermilion ${VERMILION}`,
      `fonts Fraunces / Geist / Geist Mono via next/font`,
    ].join("\n") + "\n",
  );

  const browser = await webkit.launch();
  for (const reduced of [false, true]) {
    const label = reduced ? "reduced" : "motion";
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      for (const photo of PHOTOS) {
        for (const shot of PER_PHOTO) {
          await page.goto(urlFor(shot, photo), { waitUntil: "networkidle", timeout: 60_000 });
          await hideChrome(page);
          await page.waitForTimeout(reduced ? 200 : 700);
          const name = `r2_${photo}_${vp.name}_${shot.state}_${label}.png`;
          await page.screenshot({ path: path.join(ARTIFACTS, name), animations: reduced ? "disabled" : "allow" });
        }
      }
      for (const shot of EXTRA) {
        await page.goto(urlFor(shot, shot.photo ?? "IMG_6505"), { waitUntil: "networkidle", timeout: 60_000 });
        await hideChrome(page);
        await page.waitForTimeout(reduced ? 200 : 700);
        const name = `r2_${shot.photo}_${vp.name}_${shot.state}_${label}.png`;
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
    await page.goto(`${BASE}/dev/fold?state=first&photo=IMG_6505`, { waitUntil: "networkidle", timeout: 60_000 });
    await hideChrome(page);
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/dev/fold?state=mid&photo=IMG_6505`, { waitUntil: "networkidle" });
    await hideChrome(page);
    await page.waitForTimeout(reduced ? 200 : 600);
    await page.goto(`${BASE}/dev/fold?state=result&photo=IMG_6505`, { waitUntil: "networkidle" });
    await hideChrome(page);
    await page.waitForTimeout(reduced ? 200 : 900);
    await page.goto(`${BASE}/dev/fold?state=edit&photo=IMG_6505`, { waitUntil: "networkidle" });
    await hideChrome(page);
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/dev/fold?state=save&photo=IMG_6505`, { waitUntil: "networkidle" });
    await hideChrome(page);
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/dev/fold?state=saved&photo=IMG_6505`, { waitUntil: "networkidle" });
    await hideChrome(page);
    await page.waitForTimeout(500);
    await page.close();
    const video = page.video();
    if (video) {
      const raw = await video.path();
      await writeFile(path.join(ARTIFACTS, `r2_flow_${label}_path.txt`), `${raw}\n`);
    }
    await context.close();
  }

  await browser.close();
  console.log("r2_ fold shots written");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
