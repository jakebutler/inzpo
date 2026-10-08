import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processImage, preparePaletteSource, exceedsPixelBudget, MAX_INPUT_PIXELS, MAX_INPUT_DIMENSION, MAX_STORE_EDGE, looksLikeScreenshot, deriveTitleFromFilename } from "@/lib/media";
import { MEDIA_VARIANTS } from "@/lib/r2";

async function testImage(width: number, height: number, format: "png" | "jpeg" = "png"): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } } });
  return format === "jpeg" ? image.jpeg().toBuffer() : image.png().toBuffer();
}

describe("processImage", () => {
  it("shares the exact stored-JPEG/w640 palette source without changing storage encoding", async () => {
    const input = await sharp(Buffer.from(`<svg width="2400" height="1200" xmlns="http://www.w3.org/2000/svg">
      <rect width="2400" height="1200" fill="#d0c7b2"/>
      <path d="M0 0L2400 1200H0Z" fill="#426092"/>
    </svg>`)).png().toBuffer();
    const expectedOriginal = await sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate().toColourspace("srgb")
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, chromaSubsampling: "4:4:4" }).toBuffer();
    const expectedPaletteSource = await sharp(expectedOriginal, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const prepared = await preparePaletteSource(input);
    const processed = await processImage(input, "palette-test");
    expect(prepared.original.equals(expectedOriginal)).toBe(true);
    expect(prepared.w640.buffer.equals(expectedPaletteSource)).toBe(true);
    expect(processed.original.equals(prepared.original)).toBe(true);
    expect(processed.variants.w640).toEqual({ key: "items/palette-test/w640.webp", ...prepared.w640 });
  });

  it("stores a jpeg at most 2000px on the long edge, plus the fixed variant set", async () => {
    const input = await testImage(2000, 1200);
    const id = "01TESTITEM";
    const result = await processImage(input, id);

    expect(result.width).toBe(2000);
    expect(result.height).toBe(1200);
    expect(result.mime).toBe("image/jpeg");
    expect(result.ext).toBe("jpg");
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(result.variants).sort()).toEqual([...MEDIA_VARIANTS].sort());

    const stored = await sharp(result.original).metadata();
    expect(stored.format).toBe("jpeg");
    expect(stored.space).toBe("srgb");

    for (const [name, variant] of Object.entries(result.variants)) {
      expect(variant.key).toBe(`items/${id}/${name}.webp`);
      const meta = await sharp(variant.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(Math.min(result.width, parseInt(name.slice(1), 10)));
    }

    const tall = await processImage(await testImage(1200, 1600, "jpeg"), id);
    expect(tall.ext).toBe("jpg");
    expect(tall.width).toBe(1200);
    expect(tall.height).toBe(1600);
    expect(tall.placeholder).toMatch(/^data:image\/webp;base64,/);
  });

  it("downscales a larger original to the 2000px store copy", async () => {
    const input = await testImage(6000, 4000);
    const result = await processImage(input, "x");
    expect(result.width).toBe(MAX_STORE_EDGE);
    expect(result.height).toBe(Math.round((4000 * MAX_STORE_EDGE) / 6000));
    expect(result.mime).toBe("image/jpeg");
  });

  it("does not enlarge a small original", async () => {
    const input = await testImage(800, 600);
    const result = await processImage(input, "x");
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it("rejects non-images", async () => {
    await expect(processImage(Buffer.from("definitely not an image"), "x")).rejects.toThrow();
  });
});

describe("P3 to sRGB", () => {
  it("converts through the embedded Display P3 profile and stores sRGB jpeg", async () => {
    const p3 = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 32, b: 64 } },
    })
      .withIccProfile("p3")
      .png()
      .toBuffer();

    const tagged = await sharp(p3).keepIccProfile().metadata();
    expect((tagged.icc?.byteLength ?? tagged.icc?.length ?? 0) > 0).toBe(true);

    const converted = await sharp(p3).toColourspace("srgb").resize(16, 16).removeAlpha().raw().toBuffer();
    const result = await processImage(p3, "p3");
    expect(result.mime).toBe("image/jpeg");
    const outMeta = await sharp(result.original).metadata();
    expect(outMeta.format).toBe("jpeg");
    expect(outMeta.space).toBe("srgb");
    const stored = await sharp(result.original).resize(16, 16).removeAlpha().raw().toBuffer();
    const delta = stored.reduce((sum, value, i) => sum + Math.abs(value - converted[i]!), 0);
    expect(delta).toBeLessThan(16 * 16 * 3 * 8);
  });
});

describe("pixel budget caps", () => {
  it("rejects inputs over the pixel budget", () => {
    expect(exceedsPixelBudget(6325, 6325)).toBe(true);
    expect(exceedsPixelBudget(100_000, 401)).toBe(true);
    expect(exceedsPixelBudget(6324, 6324)).toBe(false);
  });

  it("rejects inputs over the per-side cap regardless of pixel count", () => {
    expect(exceedsPixelBudget(MAX_INPUT_DIMENSION + 1, 100)).toBe(true);
    expect(exceedsPixelBudget(100, MAX_INPUT_DIMENSION + 1)).toBe(true);
    expect(exceedsPixelBudget(MAX_INPUT_DIMENSION, 1000)).toBe(false);
    expect(MAX_INPUT_PIXELS).toBe(40_000_000);
    expect(MAX_INPUT_DIMENSION).toBe(12_000);
    expect(MAX_STORE_EDGE).toBe(2000);
  });

  it("processImage rejects an oversized sharp-generated buffer", async () => {
    const bomb = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    await expect(processImage(bomb, "x")).rejects.toThrow(/too large/i);
  });

  it("processImage rejects a one-sided oversized buffer under the pixel budget", async () => {
    const wide = await sharp({ create: { width: 12_001, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    await expect(processImage(wide, "x")).rejects.toThrow(/too large/i);
  });

  it("processImage still accepts an image just under both caps and stores 2000px", async () => {
    const ok = await sharp({ create: { width: 6000, height: 4000, channels: 3, background: { r: 120, g: 40, b: 200 } } }).png().toBuffer();
    const result = await processImage(ok, "x");
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1333);
  });
});

describe("filename heuristics", () => {
  it("flags screenshots", () => {
    expect(looksLikeScreenshot("Screenshot 2026-09-02 at 10.00.png")).toBe(true);
    expect(looksLikeScreenshot("IMG_1234.jpg")).toBe(false);
    expect(looksLikeScreenshot(null)).toBe(false);
  });

  it("derives titles from filenames", () => {
    expect(deriveTitleFromFilename("dribbble-shot_final.png")).toBe("dribbble shot final");
    expect(deriveTitleFromFilename(".png")).toBe("Untitled");
    expect(deriveTitleFromFilename(undefined)).toBe("Untitled");
  });
});
