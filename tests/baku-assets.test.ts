import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  BAKU_ART_POSES, BAKU_BAND_GRAYS, BAKU_TINT_POSES,
  bakuV6BandMaskSrc, bakuV6BandsSrc, bakuV6ColorSrc, bakuV6PoseSrc, bakuV6ShadeSrc,
  type BakuDensity, type BakuArtPose,
} from "@/lib/baku-v6";
import { BAKU_UNDYED_KNIT, tintRoles, tintSpriteWithBands } from "@/lib/baku-tint";
import { emptyKit, kitForPose } from "@/lib/mascot";

const knownKit = {
  primary: "#123456", secondary: "#abcdef", accent: "#ff8000",
  background: "#0080ff", surface: "#ffffff", text: "#000000",
};
const cases = BAKU_ART_POSES.flatMap(pose => ([1, 2, 3] as const).map(density => ({ pose, density })));

async function loadAssets(pose: BakuArtPose, density: BakuDensity) {
  const [color, bands, shade] = await Promise.all([
    sharp(`public${bakuV6ColorSrc(pose, density)}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(`public${bakuV6BandsSrc(pose, density)}`).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true }),
    sharp(`public${bakuV6ShadeSrc(pose, density)}`).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true }),
  ]);
  return { color, bands, shade };
}

/** Independent reference calculation, including rounding and highlight clamping. */
function expectedRgb(hex: string, shade: number) {
  return [1, 3, 5].map(start => Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(start, start + 2), 16) * shade / 128))));
}

function verifyTint(assets: Awaited<ReturnType<typeof loadAssets>>, colors: Array<string | null>) {
  const { color, bands, shade } = assets;
  const output = new Uint8ClampedArray(color.data);
  tintSpriteWithBands(output, new Uint8ClampedArray(bands.data), color.info.width, color.info.height,
    color.info.channels, bands.info.channels, colors, new Uint8ClampedArray(shade.data), shade.info.channels);
  const counts = [0, 0, 0, 0, 0, 0];
  let untouched = 0;
  let rgbErrors = 0;
  let outsideErrors = 0;
  let alphaErrors = 0;
  for (let p = 0; p < color.info.width * color.info.height; p++) {
    const gray = bands.data[p]!;
    const i = p * 4;
    if (gray === 0) {
      untouched++;
      if (output.slice(i, i + 4).some((value, c) => value !== color.data[i + c])) outsideErrors++;
      continue;
    }
    const index = BAKU_BAND_GRAYS.indexOf(gray as typeof BAKU_BAND_GRAYS[number]);
    counts[index]++;
    const hex = colors[index];
    const expected = hex ? expectedRgb(hex, shade.data[p]!) : [...color.data.subarray(i, i + 3)];
    if (expected.some((value, c) => value !== output[i + c])) rgbErrors++;
    if (output[i + 3] !== color.data[i + 3]) alphaErrors++;
  }
  expect({ rgbErrors, outsideErrors, alphaErrors }).toEqual({ rgbErrors: 0, outsideErrors: 0, alphaErrors: 0 });
  expect(untouched + counts.reduce((a, b) => a + b, 0)).toBe(color.info.width * color.info.height);
  return { counts, untouched };
}

describe("rebuilt Designer v6 assets", () => {
  it("ships all 210 PNGs without the review sheets", () => {
    const names = readdirSync("public/baku/v6").filter(name => name.endsWith(".png"));
    expect(names).toHaveLength(210);
    expect(names.some(name => name.startsWith("_"))).toBe(false);
  });

  it.each(cases)("$pose @ $density x: exact masks, shade bounds, role formula and no bleed", async ({ pose, density }) => {
    const assets = await loadAssets(pose, density);
    const size = 48 * density;
    for (const asset of Object.values(assets)) {
      expect([asset.info.width, asset.info.height]).toEqual([size, size]);
    }
    expect(assets.color.info.channels).toBe(4);
    const paths = [bakuV6BandsSrc(pose, density), bakuV6ShadeSrc(pose, density)];
    for (const src of paths) {
      const meta = await sharp(`public${src}`).metadata();
      expect([meta.space, meta.channels]).toEqual(["b-w", 1]);
    }
    const base = await sharp(`public${bakuV6PoseSrc(pose, density)}`).metadata();
    expect([base.width, base.height]).toEqual([size, size]);
    const allowed = [0, ...BAKU_BAND_GRAYS];
    const grays = [...new Set(assets.bands.data)].sort((a, b) => a - b);
    expect(grays.every(gray => allowed.includes(gray))).toBe(true);
    expect(grays).toEqual(BAKU_TINT_POSES.has(pose) ? allowed : [0]);
    let shadeErrors = 0;
    for (let p = 0; p < size * size; p++) {
      const shade = assets.shade.data[p]!;
      if (assets.bands.data[p] ? shade < 84 || shade > 172 : shade !== 0) shadeErrors++;
    }
    expect(shadeErrors).toBe(0);
    // Each density's one-band masks must agree exactly with the indexed mask.
    await Promise.all(COLOR_ROLES.map(async (role, i) => {
      const mask = await sharp(`public${bakuV6BandMaskSrc(pose, role, density)}`)
        .toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
      expect([mask.info.width, mask.info.height, mask.info.channels]).toEqual([size, size, 1]);
      let errors = 0;
      for (let p = 0; p < size * size; p++) {
        if (mask.data[p] !== (assets.bands.data[p] === BAKU_BAND_GRAYS[i] ? 255 : 0)) errors++;
      }
      expect(errors, `${pose} ${role} @${density}x`).toBe(0);
    }));
    const { counts } = verifyTint(assets, tintRoles(kitForPose(pose, knownKit), null));
    expect(counts.every(count => BAKU_TINT_POSES.has(pose) ? count > 0 : count === 0)).toBe(true);
  });

  it("shades real empty bands oatmeal before and throughout reveal, without changing the kit", async () => {
    const assets = await loadAssets("idle", 3);
    for (const kit of [emptyKit(), { ...knownKit, accent: null, surface: null }]) {
      const snapshot = { ...kit };
      for (const count of [0, 1, 2, 3, 4, 5, 6, null]) {
        const inks = tintRoles(kitForPose("idle", kit), count);
        COLOR_ROLES.forEach((role, i) => {
          expect(inks[i]).toBe(kit[role] == null ? BAKU_UNDYED_KNIT : count != null && i >= count ? null : kit[role]);
        });
        verifyTint(assets, inks);
      }
      expect(kit).toEqual(snapshot);
    }
  });
});
