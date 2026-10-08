/**
 * r2_ fold proof: 375×667 (one-row hex) and 390×844 (3×2), no debug overlay.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";

const ARTIFACTS = "/opt/cursor/artifacts";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const STATES = ["kit", "empty-roles", "needs-text", "chips", "chips-saved"] as const;
const VIEWPORTS = [
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
] as const;

type Measure = {
  viewport: string;
  state: string;
  hexCutOff: boolean;
  hexes: Array<{ text: string; width: number; scroll: number }>;
  paletteBottom: number | null;
  contrastBottom: number | null;
  saveBarTop: number | null;
  photoHeight: number | null;
  aboveSaveBar: boolean;
};

async function measure(page: import("playwright").Page, viewport: string, state: string): Promise<Measure> {
  return page.evaluate(({ viewportName, stateName }) => {
    const hexes = [...document.querySelectorAll("[data-swatch-hex]")].map((node) => {
      const el = node as HTMLElement;
      const shown = getComputedStyle(el).display !== "none";
      return {
        text: (el.textContent ?? "").trim(),
        width: el.getBoundingClientRect().width,
        scroll: el.scrollWidth,
        shown,
        cut: shown && el.scrollWidth > el.clientWidth + 1,
        right: el.getBoundingClientRect().right,
        left: el.getBoundingClientRect().left,
      };
    });
    const contrast = document.querySelector("[data-contrast-line]");
    const palette = document.querySelector(".inzpo-swatches");
    const bar = document.querySelector("[data-save-bar]");
    const photo = document.querySelector("[data-photo-fold]");
    const contrastBox = contrast?.getBoundingClientRect();
    const paletteBox = palette?.getBoundingClientRect();
    const barBox = bar?.getBoundingClientRect();
    const photoBox = photo?.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const hexCutOff = hexes.some((row) => row.shown && (row.cut || row.right > vw + 1 || row.left < -1));
    const contrastBottom = contrastBox ? contrastBox.bottom : null;
    const saveBarTop = barBox ? barBox.top : null;
    return {
      viewport: viewportName,
      state: stateName,
      hexCutOff,
      hexes: hexes.map(({ text, width, scroll }) => ({ text, width, scroll })),
      paletteBottom: paletteBox ? paletteBox.bottom : null,
      contrastBottom,
      saveBarTop,
      photoHeight: photoBox ? photoBox.height : null,
      aboveSaveBar:
        contrastBottom != null && saveBarTop != null && paletteBox != null
          ? paletteBox.bottom < saveBarTop && contrastBottom < saveBarTop
          : false,
      inner: { vw, vh },
    };
  }, { viewportName: viewport, stateName: state });
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
      `photo max ${"45svh"}`,
      `compact max-height 700px`,
    ].join("\n") + "\n",
  );

  const browser = await webkit.launch();
  const reports: Measure[] = [];
  for (const reduced of [false, true]) {
    const label = reduced ? "reduced" : "motion";
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      for (const state of STATES) {
        await page.goto(`${BASE}/dev/fold?state=${state}`, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        const prefix = `r2_fold_${vp.name}_${state}_${label}`;
        await page.screenshot({
          path: path.join(ARTIFACTS, `${prefix}_start.png`),
          animations: reduced ? "disabled" : "allow",
        });
        if (!reduced) {
          await page.waitForTimeout(Math.round(MOTION.enter.duration * 500));
          await page.screenshot({
            path: path.join(ARTIFACTS, `${prefix}_middle.png`),
            animations: "allow",
          });
          await page.waitForTimeout(Math.round(MOTION.enter.duration * 500));
        }
        await page.screenshot({
          path: path.join(ARTIFACTS, `${prefix}_end.png`),
          animations: reduced ? "disabled" : "allow",
        });
        reports.push(await measure(page, vp.name, state));
      }
      await page.close();
    }
  }
  await browser.close();

  const failures = reports.filter((row) => row.hexCutOff || !row.aboveSaveBar);
  await writeFile(path.join(ARTIFACTS, "r2_fold_measure.txt"), JSON.stringify({ reports, failures }, null, 2) + "\n");
  if (failures.length > 0) {
    console.error("fold proof failed", failures);
    process.exit(1);
  }
  console.log("fold proof ok", reports.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
