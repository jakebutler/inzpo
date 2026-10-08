import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { COLOR_ROLES } from "@/lib/db/schema";
import { rgbToHex } from "@/lib/colors";
import { extractPalette, PALETTE_THUMB, type ExtractedPalette } from "@/lib/palette-extract";
import { markDerivedRoles, REGION_ORIGIN, sampledColors } from "@/lib/derived-roles";
import { emptyRoles, filledRoles, rolesFromColors } from "@/lib/tokens";
import { contrastRatio, pageChromeColors, textOnBackgroundContrast } from "@/lib/contrast";
import { kitWearStyle } from "@/lib/kit-wear";
import { kitAltText, kitDisplayName } from "@/lib/kit-name";
import { kitFromColors, stripeCssVars, stripeFills } from "@/lib/mascot";
import { bakuSvgMarkup } from "@/lib/mascot-svg";
import { BAKU_UNDYED_KNIT, tintRoles } from "@/lib/baku-tint";

const photos = ["IMG_6208", "IMG_6505", "IMG_5859"] as const;
const palettes = new Map<string, ExtractedPalette>();

beforeAll(async () => {
  for (const photo of photos) {
    const input = await readFile(`public/sample/${photo}.jpg`);
    const { data, info } = await sharp(input).rotate()
      .resize({ width: PALETTE_THUMB, height: PALETTE_THUMB, fit: "inside" })
      .toColourspace("srgb")
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let regions = 0;
    const palette = await extractPalette(input, (swatch, pixels, width, height) => {
      expect([width, height]).toEqual([info.width, info.height]);
      expect(pixels.length).toBeGreaterThan(0);
      const pin = Math.round(swatch.pinY * height) * width + Math.round(swatch.pinX * width);
      expect(pixels).toContain(pin);
      // Independently sum the decoded photo pixels: changed/padded token hexes
      // fail this even if they still have a valid-looking pin and share.
      const sums = [0, 0, 0];
      const members = new Set(pixels);
      for (const pixel of pixels) {
        for (let c = 0; c < 3; c++) sums[c]! += data[pixel * 3 + c]!;
      }
      expect(swatch.hex).toBe(rgbToHex(sums[0]! / pixels.length, sums[1]! / pixels.length, sums[2]! / pixels.length));
      const visited = new Set([pin]);
      const queue = [pin];
      for (let head = 0; head < queue.length; head++) {
        const i = queue[head]!;
        for (const next of [i % width ? i - 1 : -1, i % width < width - 1 ? i + 1 : -1, i - width, i + width]) {
          if (!members.has(next) || visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
      expect(visited.size).toBe(pixels.length);
      expect(swatch.origin).toBe(REGION_ORIGIN);
      regions++;
    });
    expect(regions).toBe(palette.swatches.length);
    palettes.set(photo, palette);
  }
}, 30_000);

describe("photo region provenance", () => {
  it.each(photos)("%s assigns only audited region means and pins", (photo) => {
    const palette = palettes.get(photo)!;
    for (const role of COLOR_ROLES) {
      const swatch = palette.swatches.find((s) => s.role === role);
      expect(palette.roles[role]).toBe(swatch?.hex ?? null);
      if (swatch) expect(swatch.share).toBeGreaterThan(0);
    }
    expect(rolesFromColors(palette.swatches)).toEqual(palette.roles);
    expect(palette.contrast).toBe(textOnBackgroundContrast(palette.roles));
  });

  it("captures the storefront's light-blue tiles and white paint separately", () => {
    const { swatches, roles } = palettes.get("IMG_6208")!;
    const tile = swatches.find((s) => s.pinX > 0.04 && s.pinX < 0.5 && s.pinY > 0.58 && s.pinY < 0.74 && s.lab[2] < -10);
    const white = swatches.find((s) => s.lab[0] > 80 && Math.hypot(s.lab[1], s.lab[2]) < 8);
    expect(tile).toBeDefined();
    expect(white).toBeDefined();
    expect(tile!.role).not.toBe(white!.role);
    expect(tile!.hex).not.toBe(white!.hex);
    expect(roles.accent).toBeNull();
  });

  it("retains the Victorian's yellow, pale and dark regions and the mural's red, blue and orange", () => {
    const house = palettes.get("IMG_6505")!;
    expect(house.swatches.some((s) => s.lab[0] > 70 && s.lab[2] > 15)).toBe(true);
    expect(house.swatches.some((s) => s.lab[0] < 15)).toBe(true);
    expect(house.swatches.some((s) => s.lab[0] > 80)).toBe(true);
    const mural = palettes.get("IMG_5859")!;
    expect(mural.swatches.some((s) => s.family === "red")).toBe(true);
    expect(mural.swatches.some((s) => s.lab[2] < -8)).toBe(true);
    expect(mural.swatches.some((s) => s.lab[2] > 35)).toBe(true);
  });

  it.each(photos)("%s gives Baku exactly as many stripes as filled roles", (photo) => {
    const kit = kitFromColors(palettes.get(photo)!.swatches);
    const count = filledRoles(kit).length;
    expect(stripeFills(kit)).toHaveLength(count);
    // Empty knit is artwork, not an extra kit colour or stripe.
    const tint = tintRoles(kit, null);
    COLOR_ROLES.forEach((role, i) => {
      expect(tint[i]).toBe(kit[role] ?? BAKU_UNDYED_KNIT);
    });
    expect(bakuSvgMarkup("test", kit).match(/class="baku-stripe /g)).toHaveLength(count);
    for (const role of COLOR_ROLES) {
      expect(stripeCssVars(kit)[`--baku-${role}`]).toBe(kit[role] ?? undefined);
    }
  });
});

describe("legacy colours become empty slots without changing stored rows", () => {
  it("hides tints, shared pins and originless centre fallbacks", () => {
    const rows = [
      { role: "background" as const, hex: "#c0c0c0", pinX: 0.2, pinY: 0.2, origin: "extracted" },
      { role: "primary" as const, hex: "#dddddd", pinX: 0.8, pinY: 0.2, origin: "extracted" },
      { role: "secondary" as const, hex: "#ff0000", pinX: 0.21, pinY: 0.21, origin: "extracted" },
      { role: "accent" as const, hex: "#00ff00", pinX: 0.5, pinY: 0.5 },
    ];
    const snapshot = structuredClone(rows);
    const marked = markDerivedRoles(rows);
    expect(marked.filter((r) => r.derivedFrom)).toHaveLength(3);
    expect(sampledColors(rows).map((r) => r.role)).toEqual(["background"]);
    expect(rolesFromColors(rows)).toEqual({ ...emptyRoles(), background: "#c0c0c0" });
    expect(rows).toEqual(snapshot);
    expect(rolesFromColors([{ role: "background", hex: "#123456", pinX: 0.5, pinY: 0.5 }])).toEqual(emptyRoles());
  });

  it("always preserves user-set colours and verified regions, including shared hues", () => {
    const rows = [
      { role: "background" as const, hex: "#c0c0c0", pinX: 0.2, pinY: 0.2, origin: REGION_ORIGIN },
      { role: "primary" as const, hex: "#dddddd", pinX: 0.8, pinY: 0.2, origin: REGION_ORIGIN },
      { role: "accent" as const, hex: "#ff0000", pinX: 0.5, pinY: 0.5, origin: "sampled", derivedFrom: "background" as const },
    ];
    expect(sampledColors(rows)).toHaveLength(3);
    expect(rolesFromColors(rows).accent).toBe("#ff0000");
  });
});

describe("empty kits and legible chrome", () => {
  it("keeps role colours intact and chooses accessible page colours", () => {
    for (const background of [null, "#7caed5", "#888888", "#202020"]) {
      const roles = { ...emptyRoles(), background, text: background };
      const snapshot = { ...roles };
      const chrome = pageChromeColors(roles);
      const style = kitWearStyle(roles);
      expect(contrastRatio(chrome.ink, chrome.background)).toBeGreaterThanOrEqual(4.5);
      expect(style.backgroundColor).toBe(chrome.background);
      expect(style.color).toBe(chrome.ink);
      expect(roles).toEqual(snapshot);
    }
    expect(kitDisplayName({ namedColors: [] })).toBe("");
    expect(kitAltText({ namedColors: [] })).toBe("");
    expect(bakuSvgMarkup()).not.toContain('class="baku-stripe ');
  });
});
