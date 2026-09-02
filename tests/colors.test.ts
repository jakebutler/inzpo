import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { COLOR_FAMILIES, hexToFamily, hexToHsl, normalizeHex, isHexColor, rgbToHex } from "@/lib/colors";
import { extractColors } from "@/lib/extract-colors";

describe("color taxonomy", () => {
  it("has exactly the 14 fixed families", () => {
    expect(COLOR_FAMILIES).toHaveLength(14);
    expect(COLOR_FAMILIES).toContain("cream/beige");
  });
});

describe("hexToFamily (deterministic mapping)", () => {
  const cases: Array<[string, string]> = [
    ["#000000", "black"],
    ["#111111", "black"],
    ["#ffffff", "white"],
    ["#f5f5f5", "white"],
    ["#808080", "gray"],
    ["#a9a9a9", "gray"],
    ["#ff0000", "red"],
    ["#8b0000", "red"],
    ["#ff4500", "orange"],
    ["#ffa500", "orange"],
    ["#ffd700", "gold"],
    ["#ffff00", "yellow"],
    ["#f5f5dc", "cream/beige"],
    ["#8b4513", "brown"],
    ["#5c4033", "brown"],
    ["#00ff00", "green"],
    ["#228b22", "green"],
    ["#008080", "teal"],
    ["#40e0d0", "teal"],
    ["#0000ff", "blue"],
    ["#1e90ff", "blue"],
    ["#800080", "purple"],
    ["#ff00ff", "pink"],
    ["#ffc0cb", "pink"],
  ];

  for (const [hex, family] of cases) {
    it(`${hex} -> ${family}`, () => {
      expect(hexToFamily(hex)).toBe(family);
    });
  }

  it("is deterministic and total", () => {
    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 17) {
        for (let b = 0; b < 256; b += 17) {
          const hex = rgbToHex(r, g, b);
          expect(COLOR_FAMILIES).toContain(hexToFamily(hex));
        }
      }
    }
  });
});

describe("hex helpers", () => {
  it("normalizes short and long hex", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("1A2b3C")).toBe("#1a2b3c");
    expect(isHexColor("#abc")).toBe(true);
    expect(isHexColor("nope")).toBe(false);
  });

  it("hsl conversion sanity", () => {
    expect(hexToHsl("#ff0000")).toMatchObject({ h: 0, s: 1, l: 0.5 });
  });
});

describe("extractColors", () => {
  it("returns at least one color for any image, with dominant fallback", async () => {
    const img = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 30, g: 144, b: 255 } } }).png().toBuffer();
    const colors = await extractColors(img);
    expect(colors.length).toBeGreaterThanOrEqual(1);
    expect(colors.some((c) => c.origin === "dominant" || c.origin === "extracted")).toBe(true);
    for (const c of colors) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});
