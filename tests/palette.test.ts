import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { COLOR_ROLES } from "@/lib/db/schema";
import { areaAverage, contrastRatio, extractPalette, textOnBackgroundContrast } from "@/lib/palette-extract";
import { chooseTextureCrop } from "@/lib/texture";
import { designTokenColors, moveRole, rolesFromColors, setRoleColor } from "@/lib/tokens";

async function solid(hex: string, w = 120, h = 80): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: hex },
  })
    .png()
    .toBuffer();
}

async function split(left: string, right: string, w = 200, h = 120): Promise<Buffer> {
  const half = Math.floor(w / 2);
  const l = await sharp({ create: { width: half, height: h, channels: 3, background: left } })
    .png()
    .toBuffer();
  const r = await sharp({ create: { width: w - half, height: h, channels: 3, background: right } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: l, left: 0, top: 0 },
      { input: r, left: half, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function subjectOnField(): Promise<Buffer> {
  const field = await sharp({
    create: { width: 240, height: 180, channels: 3, background: "#c8c4bc" },
  })
    .png()
    .toBuffer();
  const blob = await sharp({
    create: { width: 48, height: 48, channels: 3, background: "#d22b2b" },
  })
    .png()
    .toBuffer();
  return sharp(field)
    .composite([{ input: blob, left: 96, top: 66 }])
    .png()
    .toBuffer();
}

describe("real-only extraction", () => {
  it("keeps a single colour and leaves five slots empty", async () => {
    const palette = await extractPalette(await solid("#6b6656"));
    expect(palette.swatches).toHaveLength(1);
    expect(palette.roles.background).toBe("#6b6656");
    expect(Object.values(palette.roles).filter(Boolean)).toHaveLength(1);
    expect(palette.contrast).toBeNull();
  });

  it("samples a grayscale photo as one real RGB colour", async () => {
    const input = await sharp(await solid("#555555")).greyscale().png().toBuffer();
    const palette = await extractPalette(input);
    expect(Object.values(palette.roles).filter(Boolean)).toEqual(["#555555"]);
    expect((await areaAverage(input, 0.5, 0.5)).hex).toBe("#555555");
  });

  it("keeps real text/background samples even when their contrast fails AA", async () => {
    const palette = await extractPalette(await split("#777777", "#aaaaaa"));
    expect(Object.values(palette.roles).filter(Boolean).sort()).toEqual(["#777777", "#aaaaaa"]);
    expect(palette.contrast).toBeLessThan(4.5);
    expect(COLOR_ROLES.filter((role) => palette.roles[role] === null)).toHaveLength(4);
  });

});

describe("design tokens fallback", () => {
  it("marks empty roles as fallback of the nearest real color", () => {
    const roles = rolesFromColors([
      { hex: "#7fafd4", role: "primary" },
      { hex: "#a2afbd", role: "secondary" },
      { hex: "#384b5f", role: "background" },
      { hex: "#bec6cd", role: "text" },
    ]);
    const tokens = designTokenColors(roles);
    expect(tokens).not.toBeNull();
    expect(tokens!.primary.fallback).toBeUndefined();
    expect(tokens!.accent.fallback).toBe(true);
    expect(tokens!.surface.fallback).toBe(true);
    expect(tokens!.accent.$value).toBe("#a2afbd");
    expect(tokens!.surface.$value).toBe("#384b5f");
  });
});

describe("texture crop", () => {
  it("hides a flat single-color crop", async () => {
    const crop = await chooseTextureCrop(await solid("#d1cda4", 200, 200));
    expect(crop.flat).toBe(true);
  });

  it("aims at the subject, not the most common field color", async () => {
    const crop = await chooseTextureCrop(await subjectOnField());
    expect(crop.flat).toBe(false);
    const cx = crop.x + crop.size / 2;
    const cy = crop.y + crop.size / 2;
    expect(cx).toBeGreaterThan(0.25);
    expect(cx).toBeLessThan(0.75);
    expect(cy).toBeGreaterThan(0.2);
    expect(cy).toBeLessThan(0.8);
  });
});

describe("area-averaged eyedropper", () => {
  it("averages a neighborhood around the pin", async () => {
    const buf = await split("#ff0000", "#0000ff", 100, 40);
    const left = await areaAverage(buf, 0.2, 0.5, 4);
    const right = await areaAverage(buf, 0.8, 0.5, 4);
    expect(left.hex.startsWith("#")).toBe(true);
    expect(right.hex).not.toBe(left.hex);
  });
});

describe("token editor roles", () => {
  it("sets a role without padding the others", () => {
    const next = setRoleColor(rolesFromColors([]), "accent", "#ff8800");
    expect(next.accent).toBe("#ff8800");
    expect(next.primary).toBeNull();
    expect(next.background).toBeNull();
  });

  it("swaps two roles instead of duplicating a color", () => {
    const start = setRoleColor(setRoleColor(rolesFromColors([]), "primary", "#111111"), "text", "#eeeeee");
    const swapped = moveRole(start, "primary", "text");
    expect(swapped.primary).toBe("#eeeeee");
    expect(swapped.text).toBe("#111111");
  });
});

describe("contrast helper", () => {
  it("returns null unless both text and background are filled", () => {
    expect(textOnBackgroundContrast({ ...rolesFromColors([]), background: "#fff", text: null })).toBeNull();
    expect(contrastRatio("#000000", "#ffffff")).toBeGreaterThan(4.5);
  });
});
