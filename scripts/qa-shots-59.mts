/**
 * WebKit 390×844 stills for #59 first / result / save / edit / export.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { webkit } from "playwright";
import { MOTION, MOTION_CSS } from "../lib/motion.ts";

const ARTIFACTS = "/opt/cursor/artifacts";
const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const STATES = [
  "first-kit",
  "result-kit",
  "result-empty",
  "result-flat",
  "save-sheet",
  "kit-saved",
  "kit-edit",
  "kit-export",
  "kit-chips",
  "brief-pending",
] as const;

async function main(): Promise<void> {
  await mkdir(ARTIFACTS, { recursive: true });
  await writeFile(
    path.join(ARTIFACTS, "59_motion.txt"),
    [
      `tap ${MOTION.tap.duration}s ${MOTION.tap.ease} (${MOTION_CSS.tapMs}ms)`,
      `small ${MOTION.small.duration}s ${MOTION.small.ease} (${MOTION_CSS.smallMs}ms)`,
      `enter ${MOTION.enter.duration}s ${MOTION.enter.ease} (${MOTION_CSS.enterMs}ms)`,
      `leave ${MOTION.leave.duration}s ${MOTION.leave.ease} (${MOTION_CSS.leaveMs}ms)`,
      `reduced ${MOTION.reduced.duration}s ${MOTION.reduced.ease} (${MOTION_CSS.reducedMs}ms)`,
      `sheet enter ${MOTION.enter.duration}s ${MOTION.enter.ease}`,
      `snap button 56px (h-14) ${MOTION.tap.duration}s ${MOTION.tap.ease}`,
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
      await page.goto(`${BASE}/dev/qa?issue=59&state=${state}`, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(ARTIFACTS, `59_${state}_${label}_start.png`),
        animations: reduced ? "disabled" : "allow",
      });
      if (!reduced) {
        await page.waitForTimeout(Math.round(MOTION.enter.duration * 500));
        await page.screenshot({
          path: path.join(ARTIFACTS, `59_${state}_${label}_middle.png`),
          animations: "allow",
        });
        await page.waitForTimeout(Math.round(MOTION.enter.duration * 500));
      }
      await page.screenshot({
        path: path.join(ARTIFACTS, `59_${state}_${label}_end.png`),
        animations: reduced ? "disabled" : "allow",
      });
    }
    await page.close();
  }

  const exportPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const zip = new JSZip();
  zip.file("tokens.json", "{}");
  zip.file("tokens.css", ":root{}");
  zip.file("brief.md", "# Brief\n");
  zip.file("texture.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"512\" height=\"512\"></svg>");
  const zipBytes = await zip.generateAsync({ type: "nodebuffer" });
  await exportPage.route("**/api/kits/**/export", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/zip",
      body: zipBytes,
    });
  });
  await exportPage.goto(`${BASE}/dev/qa?issue=59&state=kit-export`, { waitUntil: "networkidle" });
  const canShare = await exportPage.evaluate(async () => {
    const file = new File([new Uint8Array([80, 75])], "kit.zip", { type: "application/zip" });
    const payload = { files: [file] };
    return typeof navigator.canShare === "function" && navigator.canShare(payload);
  });
  exportPage.once("download", () => undefined);
  await exportPage.click("button:has-text('Export kit')");
  await exportPage.waitForTimeout(800);
  const pathTaken = await exportPage.getAttribute("[data-export-path]", "data-export-path");
  await exportPage.screenshot({ path: path.join(ARTIFACTS, "59_export_webkit_path.png") });
  await writeFile(
    path.join(ARTIFACTS, "59_export_path.txt"),
    [
      `webkit canShare({files: [kit.zip]}): ${canShare}`,
      `data-export-path: ${pathTaken ?? "unset"}`,
      canShare
        ? "WebKit reported canShare true; share() attempted, download used if iOS rejected application/zip."
        : "WebKit rejected canShare for application/zip; fell back to a plain download.",
    ].join("\n") + "\n",
  );
  await exportPage.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
