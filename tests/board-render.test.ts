import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { chooseVariantKey, hostOf, isLightBackground, renderBoardToBuffer, tileForPlacement } from "@/lib/board-render";
import type { PlacementData } from "@/lib/boards";

function placementData(overrides: Partial<PlacementData>): PlacementData {
  return {
    id: "p1",
    itemId: "i1",
    x: 0,
    y: 0,
    w: 400,
    h: 300,
    z: 0,
    showLabel: false,
    kind: "screenshot",
    title: "A screenshot",
    sourceUrl: null,
    variants: { w1600: "items/i1/w1600.webp", w640: "items/i1/w640.webp", w256: "items/i1/w256.webp" },
    mediaRole: "primary",
    colors: [],
    ...overrides,
  };
}

describe("chooseVariantKey", () => {
  const variants = { w1600: "k1600", w640: "k640", w256: "k256" };
  it("picks the smallest variant that covers the target", () => {
    expect(chooseVariantKey(variants, 300)).toBe("k640");
    expect(chooseVariantKey(variants, 640)).toBe("k640");
    expect(chooseVariantKey(variants, 641)).toBe("k1600");
  });
  it("falls back to the largest available", () => {
    expect(chooseVariantKey(variants, 9999)).toBe("k1600");
    expect(chooseVariantKey({ w256: "k256" }, 9999)).toBe("k256");
  });
  it("returns null without variants", () => {
    expect(chooseVariantKey(null, 300)).toBeNull();
    expect(chooseVariantKey({}, 300)).toBeNull();
  });
});

describe("hostOf", () => {
  it("extracts hosts", () => {
    expect(hostOf("https://example.com/a?b=1")).toBe("example.com");
    expect(hostOf(null)).toBeNull();
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("tileForPlacement", () => {
  it("uses the primary asset for image kinds", () => {
    expect(tileForPlacement(placementData({ kind: "photo" }))).toEqual({ type: "image", variantKey: "items/i1/w640.webp" });
  });
  it("uses the preview for linked kinds", () => {
    expect(tileForPlacement(placementData({ kind: "url", mediaRole: "preview" }))).toEqual({ type: "image", variantKey: "items/i1/w640.webp" });
  });
  it("falls back for linked kinds without a stored preview", () => {
    const t = tileForPlacement(placementData({ kind: "article", variants: null, mediaRole: null, sourceUrl: "https://example.com/x" }));
    expect(t).toEqual({ type: "fallback", title: "A screenshot", host: "example.com" });
  });
  it("renders palettes as color bands, falling back when empty", () => {
    expect(tileForPlacement(placementData({ kind: "palette", variants: null, mediaRole: null, colors: ["#ff0000"] }))).toEqual({
      type: "palette",
      colors: ["#ff0000"],
    });
    expect(tileForPlacement(placementData({ kind: "palette", variants: null, mediaRole: null, colors: [] })).type).toBe("fallback");
  });
});

describe("isLightBackground", () => {
  it("classifies backgrounds", () => {
    expect(isLightBackground("#ffffff")).toBe(true);
    expect(isLightBackground("#f5f5f5")).toBe(true);
    expect(isLightBackground("#0a0a0a")).toBe(false);
    expect(isLightBackground("#1c1c1c")).toBe(false);
    expect(isLightBackground("nope")).toBe(false);
  });
});

describe("renderBoardToBuffer", () => {
  const board = { canvasW: 200, canvasH: 100, background: "#0a0a0a" };

  async function redImage(): Promise<Buffer> {
    return sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
  }

  it("composites image, palette, and fallback tiles onto the background", async () => {
    const buf = await renderBoardToBuffer(
      board,
      [
        { rect: { x: 10, y: 10, w: 80, h: 60 }, spec: { type: "image", variantKey: "k" } },
        { rect: { x: 110, y: 10, w: 40, h: 60 }, spec: { type: "palette", colors: ["#ff0000", "#0000ff", "#00ff00"] } },
        { rect: { x: 10, y: 78, w: 180, h: 12 }, spec: { type: "fallback", title: "T", host: "example.com" } },
      ],
      { scale: 1, loadImage: async () => redImage() },
    );
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  it("draws caption bars for labels", async () => {
    const tiles: import("@/lib/board-render").RenderTile[] = [
      { rect: { x: 10, y: 10, w: 80, h: 60 }, spec: { type: "image", variantKey: "k" } },
    ];
    const without = await renderBoardToBuffer(board, tiles, { scale: 1, loadImage: async () => redImage() });
    const withLabel = await renderBoardToBuffer(board, tiles, {
      scale: 1,
      loadImage: async () => redImage(),
      labels: [{ rect: { x: 10, y: 10, w: 80, h: 60 }, text: "A label that is fairly long and should truncate" }],
    });
    expect(withLabel.byteLength).not.toBe(without.byteLength);
  });

  it("scales the canvas at fractional scale", async () => {
    const buf = await renderBoardToBuffer(board, [], { scale: 0.5 });
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
  });
});
