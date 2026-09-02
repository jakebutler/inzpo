import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processImage, looksLikeScreenshot, deriveTitleFromFilename } from "@/lib/media";
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
