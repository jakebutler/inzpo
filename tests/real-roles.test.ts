import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { COLOR_ROLES } from "@/lib/db/schema";
import { rgbToHex } from "@/lib/colors";
import { hexToLab, MIN_ROLE_DELTA_E, pairwiseRoleDeltaE, roleDeltaE } from "@/lib/color-distance";
import { extractPalette, PALETTE_THUMB, type ExtractedPalette } from "@/lib/palette-extract";
import { markDerivedRoles, REGION_ORIGIN, sampledColors } from "@/lib/derived-roles";
import { emptyRoles, filledRoles, rolesFromColors } from "@/lib/tokens";
import { contrastRatio, pageChromeColors, textOnBackgroundContrast } from "@/lib/contrast";
import { kitWearStyle } from "@/lib/kit-wear";
import { kitAltText, kitDisplayName } from "@/lib/kit-name";
import { kitFromColors, stripeCssVars, stripeFills } from "@/lib/mascot";
import { bakuSvgMarkup } from "@/lib/mascot-svg";
import { BAKU_UNDYED_KNIT, tintRoles } from "@/lib/baku-tint";
import { preparePaletteSource } from "@/lib/media";

const photos = ["IMG_6208", "IMG_6505", "IMG_5859"] as const;
const palettes = new Map<string, ExtractedPalette>();

beforeAll(async () => {
  for (const photo of photos) {
    const { w640 } = await preparePaletteSource(await readFile(`public/sample/${photo}.jpg`));
    const input = w640.buffer;
    const { data, info } = await sharp(input).rotate()
      .resize({ width: PALETTE_THUMB, height: PALETTE_THUMB, fit: "inside" })
      .toColourspace("srgb")
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let regions = 0;
    const palette = await extractPalette(input, (swatch, pixels, width, height) => {
      expect([width, height]).toEqual([info.width, info.height]);
      expect(pixels.length).toBeGreaterThan(0);
      const pinPixel = Math.min(height - 1, Math.floor(swatch.pinY * height)) * width
        + Math.min(width - 1, Math.floor(swatch.pinX * width));
      expect(pixels).toContain(pinPixel);
      // Independently sum the decoded photo pixels: changed/padded token hexes
      // fail this even if they still have a valid-looking pin and share.
      const sums = [0, 0, 0];
      const members = new Set(pixels);
      for (const pixel of pixels) {
        for (let c = 0; c < 3; c++) sums[c]! += data[pixel * 3 + c]!;
      }
      expect(swatch.hex).toBe(rgbToHex(sums[0]! / pixels.length, sums[1]! / pixels.length, sums[2]! / pixels.length));
      // A concave component's centroid can lie in a hole; connectivity is
      // independently audited from a member, rather than a rounded centroid.
      const visited = new Set([pixels[0]!]);
      const queue = [pixels[0]!];
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

  it.each(photos)("%s separates every filled role by at least CIE76 ΔE 12", (photo) => {
    for (const pair of pairwiseRoleDeltaE(palettes.get(photo)!.roles)) {
      expect(pair.deltaE, `${photo}: ${pair.roleA}/${pair.roleB}`).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    }
  });

  it("keeps distinct storefront blue, pale paint and dark paint, leaving duplicates empty", () => {
    const { swatches, roles } = palettes.get("IMG_6208")!;
    const blue = swatches.find((s) => s.lab[0] > 50 && s.lab[2] < -10);
    const white = swatches.find((s) => s.lab[0] > 75 && Math.hypot(s.lab[1], s.lab[2]) < 8);
    expect(blue).toBeDefined();
    expect(white).toBeDefined();
    expect(blue!.role).not.toBe(white!.role);
    expect(swatches.find((s) => s.role === "text")!.lab[0]).toBeLessThan(40);
    expect(swatches).toHaveLength(4);
    expect(roles.accent).toBeNull();
    expect(roles.surface).toBeNull();
    for (const [role, reference] of Object.entries({ primary: "#719ebf", secondary: "#96a2ac",
      background: "#bac3c9", text: "#36485c" })) {
      expect(roleDeltaE(hexToLab(roles[role as keyof typeof roles]!), hexToLab(reference))).toBeLessThan(3);
    }
  });

  it("retains the Victorian's yellow, pale and dark regions and the mural's red, blue and orange", () => {
    const house = palettes.get("IMG_6505")!;
    expect(house.swatches.some((s) => s.lab[0] > 70 && s.lab[2] > 15)).toBe(true);
    expect(house.swatches.some((s) => s.lab[0] < 15)).toBe(true);
    const facade = house.swatches.find((s) => s.role === "primary")!;
    expect(roleDeltaE(facade.lab, hexToLab("#d2d0a8"))).toBeLessThan(5);
    expect(facade.lab[0]).toBeGreaterThan(70);
    expect(facade.lab[2]).toBeGreaterThan(15);
    expect(facade.family).not.toBe("blue");
    expect(facade.patch).toBeGreaterThan(0.005);
    // The largest qualifying cream component is now background. The facade
    // uses another real subject component to clear CIE76 >= 12 without tinting.
    const trim = house.swatches.find((s) => s.role === "background")!;
    expect(roleDeltaE(trim.lab, hexToLab("#d0c7b2"))).toBeLessThan(5);
    expect(trim.lab[0]).toBeGreaterThanOrEqual(75);
    expect(Math.hypot(trim.lab[1], trim.lab[2])).toBeLessThan(15);
    expect(trim.pinX).toBeGreaterThan(0.35);
    expect(trim.pinX).toBeLessThan(0.45);
    expect(trim.pinY).toBeGreaterThan(0.8);
    expect(trim.pinY).toBeLessThan(0.9);
    const mural = palettes.get("IMG_5859")!;
    expect(mural.swatches.some((s) => s.family === "red")).toBe(true);
    expect(mural.swatches.some((s) => s.lab[2] < -8)).toBe(true);
    expect(mural.swatches.some((s) => s.lab[2] > 35)).toBe(true);
    expect(mural.swatches.find((s) => s.role === "primary")!.family).toBe("red");
    for (const [role, reference] of Object.entries({ primary: "#85232b", secondary: "#05112d",
      accent: "#ca721e", background: "#bebfc1", surface: "#e6eff4", text: "#090d11" })) {
      expect(roleDeltaE(hexToLab(mural.roles[role as keyof typeof mural.roles]!), hexToLab(reference))).toBeLessThan(3);
    }
    expect(mural.swatches.find((s) => s.role === "background")!.patch).toBeGreaterThan(0.12);
    expect(mural.contrast).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["IMG_6208", "#bac3c9"],
    ["IMG_5859", "#bebfc1"],
  ])("keeps %s's existing light background on the server pipeline", (photo, reference) => {
    const palette = palettes.get(photo)!;
    const background = palette.swatches.find((s) => s.role === "background")!;
    expect(background.lab[0]).toBeGreaterThanOrEqual(75);
    expect(roleDeltaE(background.lab, hexToLab(reference))).toBeLessThan(2);
    expect(palette.contrast).toBeGreaterThanOrEqual(4.5);
  });

  it("gives IMG_6505 a cream background with passing real text and no close role pair", () => {
    const house = palettes.get("IMG_6505")!;
    const background = house.swatches.find((s) => s.role === "background")!;
    const text = house.swatches.find((s) => s.role === "text")!;
    expect(background.family).toBe("cream/beige");
    expect(background.lab[0]).toBeGreaterThanOrEqual(75);
    expect(Math.hypot(background.lab[1], background.lab[2])).toBeLessThan(15);
    expect(roleDeltaE(background.lab, hexToLab("#d5cfbe"))).toBeLessThan(5);
    expect(house.contrast).toBeGreaterThanOrEqual(10);
    expect(text.lab[0]).toBeLessThan(5);
    expect(Math.min(...pairwiseRoleDeltaE(house.roles).map((pair) => pair.deltaE)))
      .toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    expect(kitWearStyle(house.roles).backgroundColor).toBe(background.hex);
    expect(pageChromeColors(house.roles).ink).toBe(text.hex);
  });

  it.each(photos)("%s gives Baku dyed stripes only for filled roles and oatmeal for the rest", (photo) => {
    const kit = kitFromColors(palettes.get(photo)!.swatches);
    const count = filledRoles(kit).length;
    expect(stripeFills(kit)).toHaveLength(count);
    // Empty knit is artwork, not an extra kit colour or stripe.
    const tint = tintRoles(kit, null);
    COLOR_ROLES.forEach((role, i) => {
      expect(tint[i]).toBe(kit[role] ?? BAKU_UNDYED_KNIT);
    });
    const markup = bakuSvgMarkup("test", kit);
    expect(markup.match(/class="baku-stripe /g)).toHaveLength(6);
    expect(markup.match(/data-baku-empty="true"/g) ?? []).toHaveLength(6 - count);
    for (const role of COLOR_ROLES) {
      expect(stripeCssVars(kit)[`--baku-${role}`]).toBe(kit[role] ?? BAKU_UNDYED_KNIT);
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
    expect(kitDisplayName({ namedColors: [] })).toBe("Untitled kit");
    expect(kitAltText({ namedColors: [] })).toBe("Untitled kit");
    expect(bakuSvgMarkup().match(/data-baku-empty="true"/g)).toHaveLength(6);
  });
});
