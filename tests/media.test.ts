import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processImage, exceedsPixelBudget, MAX_INPUT_PIXELS, MAX_INPUT_DIMENSION, looksLikeScreenshot, deriveTitleFromFilename } from "@/lib/media";
import { MEDIA_VARIANTS } from "@/lib/r2";

async function testImage(width: number, height: number, format: "png" | "jpeg" = "png"): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } } });
  return format === "jpeg" ? image.jpeg().toBuffer() : image.png().toBuffer();
}

describe("processImage", () => {
  it("produces the fixed variant set, placeholder, and true metadata", async () => {
    const input = await testImage(2000, 1200);
    const id = "01TESTITEM";
    const result = await processImage(input, id);

    expect(result.width).toBe(2000);
    expect(result.height).toBe(1200);
    expect(result.mime).toBe("image/png");
    expect(result.ext).toBe("png");
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(result.variants).sort()).toEqual([...MEDIA_VARIANTS].sort());

    for (const [name, variant] of Object.entries(result.variants)) {
      expect(variant.key).toBe(`items/${id}/${name}.webp`);
      const meta = await sharp(variant.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(Math.min(2000, parseInt(name.slice(1), 10)));
    }

    const tall = await processImage(await testImage(1200, 1600, "jpeg"), id);
    expect(tall.ext).toBe("jpg");
    expect(tall.placeholder).toMatch(/^data:image\/webp;base64,/);
  });

  it("rejects non-images", async () => {
    await expect(processImage(Buffer.from("definitely not an image"), "x")).rejects.toThrow();
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
  });

  it("processImage rejects an oversized sharp-generated buffer", async () => {
    const bomb = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    await expect(processImage(bomb, "x")).rejects.toThrow(/too large/i);
  });

  it("processImage rejects a one-sided oversized buffer under the pixel budget", async () => {
    const wide = await sharp({ create: { width: 12_001, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    await expect(processImage(wide, "x")).rejects.toThrow(/too large/i);
  });

  it("processImage still accepts an image just under both caps", async () => {
    const ok = await sharp({ create: { width: 6000, height: 4000, channels: 3, background: { r: 120, g: 40, b: 200 } } }).png().toBuffer();
    const result = await processImage(ok, "x");
    expect(result.width).toBe(6000);
    expect(result.height).toBe(4000);
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
