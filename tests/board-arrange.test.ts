import { describe, expect, it } from "vitest";
import { colsForCount, contentBottom, packGridBand, packGridFull } from "@/lib/board-arrange";

const canvas = { w: 1600, h: 900 };

describe("colsForCount", () => {
  it("follows the ladder", () => {
    expect(colsForCount(0)).toBe(0);
    expect(colsForCount(1)).toBe(1);
    expect(colsForCount(2)).toBe(2);
    expect(colsForCount(4)).toBe(2);
    expect(colsForCount(5)).toBe(3);
    expect(colsForCount(9)).toBe(3);
    expect(colsForCount(10)).toBe(4);
    expect(colsForCount(17)).toBe(5);
  });
});

describe("packGridFull", () => {
  it("produces one rect per item inside the canvas", () => {
    for (const n of [1, 2, 4, 7, 12, 30]) {
      const rects = packGridFull(n, canvas);
      expect(rects).toHaveLength(n);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(canvas.w);
        expect(r.y + r.h).toBeLessThanOrEqual(canvas.h);
      }
    }
  });

  it("lays a 2x2 grid for four items, centered with a fixed gutter", () => {
    const rects = packGridFull(4, canvas);
    const xs = [...new Set(rects.map((r) => r.x))].sort((a, b) => a - b);
    const ys = [...new Set(rects.map((r) => r.y))].sort((a, b) => a - b);
    expect(xs).toHaveLength(2);
    expect(ys).toHaveLength(2);
    expect(xs[1] - (xs[0] + rects[0].w)).toBe(24);
    expect(ys[1] - (ys[0] + rects[0].h)).toBe(24);
    expect(xs[0]).toBe(24);
    expect(rects[0].w).toBe(764);
  });

  it("is deterministic", () => {
    expect(packGridFull(9, canvas)).toEqual(packGridFull(9, canvas));
  });
});

describe("packGridBand", () => {
  it("starts below the given content edge with the same rhythm", () => {
    const first = packGridFull(4, canvas);
    const bottom = contentBottom(first, canvas);
    const band = packGridBand(2, canvas, bottom);
    const full = packGridFull(2, canvas);
    expect(band.map((r) => ({ ...r, y: r.y - bottom }))).toEqual(full);
    for (const r of band) expect(r.y).toBeGreaterThanOrEqual(bottom);
  });
});

describe("contentBottom", () => {
  it("returns 0 for empty content", () => {
    expect(contentBottom([], canvas)).toBe(0);
  });
  it("adds a gutter below the lowest edge", () => {
    expect(contentBottom([{ x: 0, y: 0, w: 100, h: 400 }], canvas)).toBe(424);
  });
});
