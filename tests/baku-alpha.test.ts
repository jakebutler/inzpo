import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BAKU_ART_POSES, BAKU_SHADOW_CLIP_PCT } from "@/lib/baku-v6";
import { processSprite, removePaper, verifySprite } from "../scripts/baku-alpha.mjs";

const PAPER = [243, 238, 228];
const cases = ([48, 72] as const).flatMap(assetSize => BAKU_ART_POSES.flatMap(pose => ([1, 2, 3] as const).flatMap(density =>
  ["", "-color"].map(variant => ({ pose, density, variant, assetSize })),
)));

describe("transparent Baku PNGs", () => {
  it.each(cases)("$assetSize px $pose ($variant) @$density x: transparent exterior, feathered knit and black contact shadow", async ({ pose, density, variant, assetSize }) => {
    const [sprite, bands] = await Promise.all([
      sharp(`public/baku/v6/baku-${pose}${assetSize === 72 ? "-lg" : ""}${variant}@${density}x.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(`public/baku/v6/baku-${pose}${assetSize === 72 ? "-lg" : ""}-bands@${density}x.png`).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true }),
    ]);
    const { width, height } = sprite.info;
    const meta = await sharp(`public/baku/v6/baku-${pose}${assetSize === 72 ? "-lg" : ""}${variant}@${density}x.png`).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect([width, height, sprite.info.channels]).toEqual([assetSize * density, assetSize * density, 4]);
    expect([bands.info.width, bands.info.height, bands.info.channels]).toEqual([width, height, 1]);
    for (const p of [0, width - 1, (height - 1) * width, width * height - 1]) expect(sprite.data[p * 4 + 3]).toBe(0);
    let transparent = 0, bandErrors = 0, shadows = 0;
    const cut = Math.floor(height * (1 - BAKU_SHADOW_CLIP_PCT / 100));
    for (let p = 0; p < width * height; p++) {
      const i = p * 4, alpha = sprite.data[i + 3]!;
      if (alpha === 0) transparent++;
      if (bands.data[p] && alpha === 0) bandErrors++;
      if (alpha > 0 && alpha < 255) {
        // Designer knit edges are feathered; their original alpha must be preserved.
        if (p >= cut * width && sprite.data.subarray(i, i + 3).every(value => value === 0)) {
          shadows++;
          expect(alpha).toBeLessThanOrEqual(57);
        }
      }
    }
    expect(transparent / (width * height)).toBeGreaterThanOrEqual(0.3);
    expect(bandErrors).toBe(0);
    expect(shadows).toBeGreaterThan(0);
    expect(removePaper(sprite.data, bands.data, width, height)).toEqual(sprite.data);
  });
});

describe("alpha conversion", () => {
  it("skips alpha originals byte-for-byte and never reads or changes auxiliary files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "baku-alpha-skip-"));
    try {
      for (const name of ["baku-idle@1x.png", "baku-idle-lg-color@3x.png"]) {
        const original = await readFile(`public/baku/v6/${name}`);
        await writeFile(join(directory, name), original);
        // No bands file exists: skip must happen before reading conversion inputs.
        expect(await processSprite(directory, name)).toBe("skipped");
        expect(await readFile(join(directory, name))).toEqual(original);
      }
      for (const suffix of ["bands", "band1", "band6", "shade", "mask"]) {
        for (const size of ["", "-lg"]) {
          const name = `baku-idle${size}-${suffix}@1x.png`;
          const original = Buffer.from("do not read or encode auxiliary maps");
          await writeFile(join(directory, name), original);
          expect(await processSprite(directory, name)).toBe("skipped");
          expect(await readFile(join(directory, name))).toEqual(original);
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("build/test scripts consume original assets without invoking alpha conversion", () => {
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
    for (const name of ["prebuild", "build", "postbuild", "pretest", "test", "posttest"]) {
      expect(scripts[name] ?? "").not.toMatch(/baku-alpha/);
    }
  });
  it("protects enclosed paper and band RGB, recovers blended edges, and makes a black-alpha shadow", () => {
    const width = 12, height = 12;
    const input = Buffer.from(Array.from({ length: width * height }, () => [...PAPER, 255]).flat());
    const bands = new Uint8Array(width * height);
    const set = (x: number, y: number, rgb: number[]) => input.set([...rgb, 255], (y * width + x) * 4);
    const foreground = [80, 60, 40];
    for (let y = 3; y <= 8; y++) for (let x = 3; x <= 8; x++) set(x, y, foreground);
    set(6, 6, PAPER); // Enclosed paper must survive the flood fill.
    // A tiny enclosed detail is diagonally adjacent to the exterior edge strip.
    for (const [x, y] of [[0, 1], [1, 0], [2, 1], [1, 2]]) set(x!, y!, foreground);
    set(3, 5, PAPER.map((paper, c) => Math.round((paper + foreground[c]!) / 2)));
    set(0, 5, PAPER); // Even border-connected band pixels must stay opaque.
    bands[5 * width] = 40;
    const shadowRgb = [201, 197, 189];
    set(3, 11, shadowRgb);
    const output = removePaper(input, bands, width, height);
    verifySprite(input, output, bands, width, height);
    expect([...output.subarray((6 * width + 6) * 4, (6 * width + 6) * 4 + 4)]).toEqual([...PAPER, 255]);
    expect([...output.subarray((width + 1) * 4, (width + 1) * 4 + 4)]).toEqual([...PAPER, 255]);
    expect([...output.subarray(5 * width * 4, 5 * width * 4 + 4)]).toEqual([...PAPER, 255]);
    const edge = (5 * width + 3) * 4;
    expect(output[edge + 3]).toBeGreaterThanOrEqual(126);
    expect(output[edge + 3]).toBeLessThanOrEqual(130);
    foreground.forEach((value, c) => expect(Math.abs(output[edge + c]! - value)).toBeLessThanOrEqual(2));
    const shadow = (11 * width + 3) * 4;
    const luminance = (rgb: number[]) => rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
    expect([...output.subarray(shadow, shadow + 4)]).toEqual([0, 0, 0, Math.round((1 - luminance(shadowRgb) / luminance(PAPER)) * 255)]);
    for (let p = 0; p < width * height; p++) {
      if (output[p * 4 + 3] === 255) expect(output.subarray(p * 4, p * 4 + 3)).toEqual(input.subarray(p * 4, p * 4 + 3));
    }
    expect(removePaper(output, bands, width, height)).toEqual(output);
  });
});
