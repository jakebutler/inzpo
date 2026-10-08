import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MASCOT_SIZE_UPLOAD_PX } from "@/lib/mascot";
import { bakuDensity, bakuV6PoseSrc } from "@/lib/baku-v6";

const src = (file: string) => readFileSync(file, "utf8");

describe("small visual fixes", () => {
  it("draws the baked black-alpha shadow once without a filter or body clip", async () => {
    const sprite = src("app/components/BakuSprite.tsx");
    expect(sprite.match(/<img\b/g)).toHaveLength(1);
    expect(sprite).not.toMatch(/brightness\(0\)|clipPath|bakeShadow/);
    const { data, info } = await sharp("public/baku/v6/baku-idle@3x.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let shadows = 0;
    for (let p = 0; p < info.width * info.height; p++) {
      const i = p * 4, alpha = data[i + 3]! / 255;
      if (alpha <= 0 || alpha >= 1 || data[i] || data[i + 1] || data[i + 2]) continue;
      shadows++;
      for (const ground of [[66, 98, 151], [190, 190, 193], [243, 238, 228], [0, 0, 0]]) {
        expect(ground.map(c => c * (1 - alpha)).every((c, channel) => c <= ground[channel]!)).toBe(true);
      }
    }
    expect(shadows).toBeGreaterThan(0);
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
    expect(src("app/components/BakuSprite.tsx")).toContain("bakuDensity(useDensity() * Math.max(1, size / assetSize))");
    const density = bakuDensity(1 * (MASCOT_SIZE_UPLOAD_PX / 48));
    const image = await sharp(`public${bakuV6PoseSrc("chewing", density)}`).metadata();
    expect(image.width).toBeGreaterThanOrEqual(MASCOT_SIZE_UPLOAD_PX);
    expect(image.height).toBeGreaterThanOrEqual(MASCOT_SIZE_UPLOAD_PX);
  });

  it("reserves static title skeletons in cards and saved headers", () => {
    expect(src("app/components/KitCard.tsx")).toContain("useKitDisplayName({ title: rawTitle,");
    for (const file of ["app/components/BandStripe.tsx", "app/components/SavedKitHeader.tsx"]) {
      expect(src(file)).toContain("data-title-skeleton");
      expect(src(file)).not.toContain('"Untitled kit"');
    }
  });
});
