/**
 * WebKit 390×844 stills for #55 empty-role palette / Baku stripes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";

const ARTIFACTS = "/opt/cursor/artifacts";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const STATES = ["empty-roles", "one-role"] as const;

async function main(): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  await writeFile(
    path.join(ARTIFACTS, "55_motion.txt"),
    [
      `tap ${MOTION.tap.duration}s ${MOTION.tap.ease} (${MOTION_CSS.tapMs}ms)`,
      `small ${MOTION.small.duration}s ${MOTION.small.ease} (${MOTION_CSS.smallMs}ms)`,
      `enter ${MOTION.enter.duration}s ${MOTION.enter.ease} (${MOTION_CSS.enterMs}ms)`,
      `leave ${MOTION.leave.duration}s ${MOTION.leave.ease} (${MOTION_CSS.leaveMs}ms)`,
      `reduced ${MOTION.reduced.duration}s ${MOTION.reduced.ease} (${MOTION_CSS.reducedMs}ms)`,
    ].join("\n") + "\n",
  );

  const browser = await webkit.launch();
  for (const reduced of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const label = reduced ? "reduced" : "motion";
    for (const state of STATES) {
      await page.goto(`${BASE}/dev/qa?issue=55&state=${state}`, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(ARTIFACTS, `55_${state}_${label}_start.png`),
        animations: reduced ? "disabled" : "allow",
      });
      if (!reduced) {
        await page.waitForTimeout(Math.round(MOTION.enter.duration * 500));
        await page.screenshot({
          path: path.join(ARTIFACTS, `55_${state}_${label}_middle.png`),
          animations: "allow",
        });
        await page.waitForTimeout(Math.round(MOTION.enter.duration * 500));
      }
      await page.screenshot({
        path: path.join(ARTIFACTS, `55_${state}_${label}_end.png`),
        animations: reduced ? "disabled" : "allow",
      });
    }
    await page.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
