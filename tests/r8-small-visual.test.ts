import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MASCOT_SIZE_UPLOAD_PX } from "@/lib/mascot";
import { bakuDensity, bakuV6PoseSrc } from "@/lib/baku-v6";
import { multiplyShadowPixels } from "@/lib/baku-tint";

const src = (file: string) => readFileSync(file, "utf8");

describe("small visual fixes", () => {
  it("darkens every ground, including the shadow fallback before canvas composition", () => {
    const sprite = src("app/components/BakuSprite.tsx");
    expect(sprite).toContain('filter: "brightness(0)"');
    expect(sprite).toContain("opacity: 0.18");
    expect(sprite).toContain('"#000000",\n    BAKU_SHADOW_CLIP_PCT');
    const pixels = new Uint8ClampedArray([243, 238, 228, 128]);
    multiplyShadowPixels(pixels, 1, 1, 4, "#000000", 100);
    expect([...pixels]).toEqual([0, 0, 0, 128]);
    for (const ground of [[56, 75, 95], [243, 238, 228], [0, 0, 0]]) {
      expect(ground.map(c => c * (1 - 0.18 * pixels[3] / 255)).every((c, i) => c <= ground[i])).toBe(true);
    }
  });

  it("shows a static skeleton instead of pending brief glyphs", () => {
    const brief = src("app/components/BriefSlot.tsx");
    expect(brief).toMatch(/status === "pending" && !saved \? \(\s*<span data-brief-skeleton/);
    const skeleton = brief.match(/<span data-brief-skeleton[^>]*\/>/)?.[0];
    expect(skeleton).toBeDefined();
    expect(skeleton).not.toMatch(/animation|transition/);
  });

  it("renders upload wait at 96px with a raster at least that large", async () => {
    expect(MASCOT_SIZE_UPLOAD_PX).toBe(96);
    for (const file of ["app/capture/CaptureForm.tsx", "app/components/CaptureMascotLayer.tsx"]) {
      expect(src(file)).toContain("size={MASCOT_SIZE_UPLOAD_PX}");
      expect(src(file)).toContain('align="center"');
    }
    expect(src("app/components/BakuSprite.tsx")).toContain("bakuDensity(useDensity() * Math.max(1, size / 48))");
    const density = bakuDensity(1 * (MASCOT_SIZE_UPLOAD_PX / 48));
    const image = await sharp(`public${bakuV6PoseSrc("chewing", density)}`).metadata();
    expect(image.width).toBeGreaterThanOrEqual(MASCOT_SIZE_UPLOAD_PX);
    expect(image.height).toBeGreaterThanOrEqual(MASCOT_SIZE_UPLOAD_PX);
  });

  it("reserves static title skeletons in cards and saved headers", () => {
    expect(src("app/components/KitCard.tsx")).toContain("kitDisplayName({ title: rawTitle })");
    for (const file of ["app/components/BandStripe.tsx", "app/components/SavedKitHeader.tsx"]) {
      expect(src(file)).toContain("data-title-skeleton");
      expect(src(file)).not.toContain('"Untitled kit"');
    }
  });
});
