import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { BAKU_SHADOW_CLIP_PCT } from "../lib/baku-v6.js";

const PAPER = [243, 238, 228] as const;
// The flat area is exact paper; resampling introduces +/- 1..6 at its edge.
const PAPER_TOLERANCE = 6;
const luminance = (rgb: readonly number[]) => rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
const PAPER_LUMINANCE = luminance(PAPER);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Straight (unassociated) RGBA, never premultiplied RGB. Band pixels are protected. */
export function removePaper(input: Uint8Array, bands: Uint8Array, width: number, height: number): Buffer {
  const count = width * height;
  assert.equal(input.length, count * 4);
  assert.equal(bands.length, count);
  // Already converted (or older transparent artwork): leave every byte alone.
  if (input.some((value, i) => i % 4 === 3 && value !== 255)) return Buffer.from(input);
  const output = Buffer.from(input);
  const kind = new Uint8Array(count); // 1 paper, 2 neutral baked ground shadow
  const exterior = new Uint8Array(count);
  const queue = new Int32Array(count);
  const cut = Math.floor(height * (1 - BAKU_SHADOW_CLIP_PCT / 100));
  for (let p = 0; p < count; p++) {
    if (bands[p]) continue;
    const i = p * 4;
    const rgb = [input[i]!, input[i + 1]!, input[i + 2]!];
    if (rgb.every((value, c) => Math.abs(value - PAPER[c]!) <= PAPER_TOLERANCE)) {
      kind[p] = 1;
    } else if (Math.floor(p / width) >= cut) {
      // A gray shadow scales all three paper channels equally. Brown feet do not.
      const ratios = rgb.map((value, c) => value / PAPER[c]!);
      if (Math.max(...ratios) < 1 && Math.max(...ratios) - Math.min(...ratios) <= 0.018) kind[p] = 2;
    }
  }
  let tail = 0;
  const visit = (p: number) => {
    if (!exterior[p] && kind[p]) {
      exterior[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  for (let head = 0; head < tail; head++) {
    const p = queue[head]!;
    const x = p % width;
    if (x > 0) visit(p - 1);
    if (x + 1 < width) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < count) visit(p + width);
  }
  for (let p = 0; p < count; p++) {
    if (!exterior[p]) continue;
    const i = p * 4;
    if (kind[p] === 1) {
      output[i + 3] = 0;
    } else {
      const alpha = clamp(1 - luminance([input[i]!, input[i + 1]!, input[i + 2]!]) / PAPER_LUMINANCE, 0, 0.5);
      output[i] = output[i + 1] = output[i + 2] = 0;
      output[i + 3] = Math.round(alpha * 255);
    }
  }

  // Distance from the border-connected region limits decontamination to its edge.
  // Enclosed paper-coloured details and the fully opaque interior remain untouched.
  const distance = new Uint16Array(count).fill(65535);
  tail = 0;
  for (let p = 0; p < count; p++) if (exterior[p]) { distance[p] = 0; queue[tail++] = p; }
  const neighbours = (p: number, fn: (q: number) => void) => {
    const x = p % width, y = Math.floor(p / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) fn(p + dy * width + dx);
    }
  };
  for (let head = 0; head < tail; head++) {
    const p = queue[head]!;
    neighbours(p, q => {
      if (distance[q] === 65535) { distance[q] = distance[p]! + 1; queue[tail++] = q; }
    });
  }
  const edgeWidth = Math.max(1, Math.round(width / 72)); // 1px at 1x/2x, 2px at 3x
  const radius = edgeWidth + 2;
  for (let p = 0; p < count; p++) {
    if (exterior[p] || bands[p] || kind[p] === 1 || distance[p]! > edgeWidth) continue;
    const i = p * 4, x = p % width, y = Math.floor(p / width);
    const delta = PAPER.map((paper, c) => input[i + c]! - paper);
    // Resampling rings just outside the feet/chewing thread overshoot paper by
    // up to 15 levels. A blend toward the darker body has negative coverage here;
    // clamp it to zero, only in this exterior edge strip (never inside the body).
    if (delta.every(value => value >= 0) && Math.max(...delta) <= 16) {
      output[i + 3] = 0;
      continue;
    }
    let bestScore = Infinity, bestAlpha = 1;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const q = ny * width + nx;
      if (distance[q]! <= edgeWidth || exterior[q]) continue;
      const vector = PAPER.map((paper, c) => input[q * 4 + c]! - paper);
      const lengthSquared = vector.reduce((sum, value) => sum + value * value, 0);
      if (lengthSquared < 400) continue;
      const alpha = delta.reduce((sum, value, c) => sum + value * vector[c]!, 0) / lengthSquared;
      if (alpha <= 0 || alpha >= 0.98) continue;
      const residual = Math.max(...delta.map((value, c) => Math.abs(value - alpha * vector[c]!)));
      if (residual > 6) continue;
      // Prefer nearby foreground samples on the same paper-to-body colour vector.
      const score = residual + Math.hypot(dx, dy) * 0.75;
      if (score < bestScore) { bestScore = score; bestAlpha = alpha; }
    }
    if (bestAlpha === 1) continue;
    // Keep recovered RGB in gamut and prevent amplified bright resampling halos.
    const minimumAlpha = Math.max(...delta.map((value, c) => value < 0 ? -value / PAPER[c]! : value / (255 - PAPER[c]!)));
    const alphaByte = Math.ceil(clamp(Math.max(bestAlpha, minimumAlpha), 1 / 255, 1) * 255);
    const alpha = alphaByte / 255;
    const foreground = PAPER.map((paper, c) => Math.round(paper + delta[c]! / alpha));
    if (foreground.some((value, c) => value > PAPER[c]! + 8)) continue;
    for (let c = 0; c < 3; c++) output[i + c] = clamp(foreground[c]!, 0, 255);
    output[i + 3] = alphaByte;
  }
  return output;
}

export function verifySprite(input: Uint8Array, output: Uint8Array, bands: Uint8Array, width: number, height: number): void {
  assert.equal(output.length, input.length, "Dimensions must be unchanged");
  for (let p = 0; p < width * height; p++) {
    if (!bands[p]) continue;
    const i = p * 4;
    assert.equal(output[i + 3], 255, `Band pixel ${p} must stay opaque`);
    for (let c = 0; c < 3; c++) assert.equal(output[i + c], input[i + c], `Band RGB changed at ${p}`);
  }
  for (const p of [0, width - 1, (height - 1) * width, width * height - 1]) assert.equal(output[p * 4 + 3], 0, "Corner must be transparent");
}

const SPRITE_NAME = /^baku-(idle|chewing|success|error-brief|404|empty|error-photo)(-lg)?(-color)?@[123]x\.png$/;

/** Optional legacy conversion only; build/test consume the shipped Designer originals. */
export async function processSprite(directory: string, name: string): Promise<"skipped" | "processed"> {
  if (!SPRITE_NAME.test(name)) return "skipped"; // Never touch bands, bandN, shade, or masks.
  const path = join(directory, name);
  const original = await readFile(path);
  // Designer originals with an alpha channel are authoritative: never decode/re-encode them.
  if ((await sharp(original).metadata()).hasAlpha) return "skipped";
  const { data: input, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bandName = name.replace(/(-color)?@/, "-bands@");
  const { data: bands, info: bandInfo } = await sharp(join(directory, bandName)).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([bandInfo.width, bandInfo.height, bandInfo.channels], [info.width, info.height, 1]);
  const output = removePaper(input, bands, info.width, info.height);
  verifySprite(input, output, bands, info.width, info.height);
  if (!output.equals(input)) {
    const png = await sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([decoded.info.width, decoded.info.height], [info.width, info.height]);
    assert.deepEqual(decoded.data, output, "PNG encoding must be lossless");
    verifySprite(input, decoded.data, bands, info.width, info.height);
    assert.deepEqual(removePaper(decoded.data, bands, info.width, info.height), output, "Conversion must be idempotent");
    await writeFile(path, png);
    return "processed";
  }
  return "skipped";
}

async function main() {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../public/baku/v6");
  const names = (await readdir(directory)).filter(name => SPRITE_NAME.test(name)).sort();
  let skipped = 0, processed = 0;
  for (const name of names) {
    const result = await processSprite(directory, name);
    if (result === "skipped") skipped++;
    else processed++;
    console.log(`${name}: ${result}`);
  }
  console.log(`Baku alpha: ${skipped} skipped, ${processed} processed`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
