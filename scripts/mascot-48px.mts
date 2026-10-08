/**
 * 48px Baku screenshots for the #53 IMG_6505 and IMG_6208 palettes.
 * Writes labeled frames plus exact 48×48 clips to /opt/cursor/artifacts.
 */
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { COLOR_ROLES } from "../lib/db/schema.ts";
import {
  BAKU_CREAM,
  BAKU_SEAM,
  HANDOFF_KITS,
  stripeCssVars,
  type MascotKit,
} from "../lib/mascot.ts";
import { bakuPlaceholderBytes, bakuSvgMarkup } from "../lib/mascot-svg.ts";

const ARTIFACTS = "/opt/cursor/artifacts";
const ROOT = path.resolve(import.meta.dirname, "..");

function kitStyle(kit: MascotKit): string {
  const vars = stripeCssVars(kit);
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function swatches(kit: MascotKit): string {
  return COLOR_ROLES.map((role) => {
    const hex = kit[role];
    return `<span class="swatch"><i style="background:${hex}"></i><b>${role}</b><code>${hex}</code></span>`;
  }).join("");
}

function card(id: string, label: string, kit: MascotKit): string {
  return `<article class="card">
    <div class="row">
      <div class="baku" id="${id}" data-pose="chewing" data-seams="on" style="width:48px;height:48px;${kitStyle(kit)}">${bakuSvgMarkup(id + "-clip")}</div>
      <div>
        <h1>${label}</h1>
        <p>48px · token order · darker seams</p>
      </div>
    </div>
    <div class="swatches">${swatches(kit)}</div>
  </article>`;
}

async function main(): Promise<void> {
  const css = await readFile(path.join(ROOT, "app/components/mascot.css"), "utf8");
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<title>Baku 48px palette tests</title>
<style>
  html,body{margin:0;background:#1a1a1a;color:#ececec;font:14px/1.4 ui-sans-serif,system-ui;padding:16px}
  .card{background:#242424;border:1px solid #333;border-radius:16px;padding:16px;margin-bottom:16px}
  .row{display:flex;align-items:center;gap:12px}
  h1{font-size:15px;margin:0}
  p{margin:2px 0 0;color:#a3a3a3;font-size:12px}
  .swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .swatch{display:flex;align-items:center;gap:6px;font-size:11px;color:#a3a3a3}
  .swatch i{display:block;width:16px;height:16px;border-radius:999px;border:1px solid #111;box-shadow:inset 0 0 0 1px rgb(0 0 0 / 25%)}
  .swatch code{font-variant-numeric:tabular-nums}
  .zoom{margin-top:16px}
  .zoom .baku{width:192px;height:192px}
  ${css}
</style>
<body>
  ${card("baku-6505", "IMG_6505", HANDOFF_KITS.IMG_6505)}
  ${card("baku-6208", "IMG_6208 (cream-padded)", HANDOFF_KITS.IMG_6208)}
  <p style="color:#737373;font-size:12px">Cream coat ${BAKU_CREAM} · seam ${BAKU_SEAM}. Near-black #0a0c0b (6505 text) and near-white #bec6cd (6208 text) must keep a hairline on the cream body.</p>
</body>
</html>`;

  await mkdir(ARTIFACTS, { recursive: true });
  const htmlPath = path.join(ARTIFACTS, "baku_48px_palettes.html");
  await writeFile(htmlPath, html);

  const svgBytes = bakuPlaceholderBytes();
  const cssBytes = Buffer.byteLength(css);
  const combined = Buffer.concat([Buffer.from(bakuSvgMarkup()), Buffer.from(css)]);
  const report = [
    `SVG placeholder markup: ${svgBytes} bytes`,
    `mascot.css: ${cssBytes} bytes`,
    `SVG + CSS source: ${combined.length} bytes`,
    `SVG + CSS gzip: ${gzipSync(combined).length} bytes`,
    `No @rive-app dependency.`,
  ].join("\n");
  await writeFile(path.join(ARTIFACTS, "baku_svg_placeholder_bytes.txt"), `${report}\n`);
  console.log(report);

  const engine = process.env.MASCOT_SHOT_ENGINE === "chromium" ? chromium : webkit;
  const browser = await engine.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.goto(`file://${htmlPath}`);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.screenshot({
    path: path.join(ARTIFACTS, "baku_48px_img_6505_and_img_6208.png"),
    animations: "disabled",
  });
  await page.locator("#baku-6505").screenshot({
    path: path.join(ARTIFACTS, "baku_48px_img_6505.png"),
    animations: "disabled",
  });
  await page.locator("#baku-6208").screenshot({
    path: path.join(ARTIFACTS, "baku_48px_img_6208.png"),
    animations: "disabled",
  });

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
