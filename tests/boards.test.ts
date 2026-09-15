import { describe, expect, it } from "vitest";
import { clampPlacement, isValidHex, MAX_PLACEMENTS, normalizeTitle, validatePlacements } from "@/lib/board-shared";

const canvas = { w: 1600, h: 900 };

describe("isValidHex", () => {
  it("accepts six-digit hex", () => {
    expect(isValidHex("#0a0a0a")).toBe(true);
    expect(isValidHex("#FFFFFF")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isValidHex("fff")).toBe(false);
    expect(isValidHex("#fff")).toBe(false);
    expect(isValidHex("#gggggg")).toBe(false);
    expect(isValidHex("")).toBe(false);
  });
});

describe("normalizeTitle", () => {
  it("trims and caps length", () => {
    expect(normalizeTitle("  hi  ")).toBe("hi");
    expect(normalizeTitle("x".repeat(200))).toHaveLength(120);
  });
  it("falls back to Untitled board", () => {
    expect(normalizeTitle("   ")).toBe("Untitled board");
  });
});

describe("clampPlacement", () => {
  it("enforces minimum size and clamps into the canvas", () => {
    const p = clampPlacement({ itemId: "a", x: 9999, y: -50, w: 10, h: 99999, z: 3, showLabel: "yes" }, canvas);
    expect(p).toEqual({ itemId: "a", x: 1600 - 48, y: 0, w: 48, h: 900, z: 3, showLabel: false });
  });
  it("rejects missing item ids", () => {
    expect(clampPlacement({ x: 1, y: 1, w: 100, h: 100 }, canvas)).toBeNull();
    expect(clampPlacement({ itemId: "", w: 100, h: 100 }, canvas)).toBeNull();
  });
  it("keeps valid placements untouched", () => {
    const p = clampPlacement({ itemId: "a", x: 10, y: 20, w: 300, h: 200, z: 0, showLabel: true }, canvas);
    expect(p).toEqual({ itemId: "a", x: 10, y: 20, w: 300, h: 200, z: 0, showLabel: true });
  });
});

describe("validatePlacements", () => {
  it("throws on non-arrays", () => {
    expect(() => validatePlacements("nope", canvas)).toThrow();
    expect(() => validatePlacements({ itemId: "a" }, canvas)).toThrow();
  });
  it("enforces the placement cap", () => {
    const many = Array.from({ length: MAX_PLACEMENTS + 1 }, (_, i) => ({ itemId: `i${i}`, x: 0, y: 0, w: 100, h: 100 }));
    expect(() => validatePlacements(many, canvas)).toThrow(/max 100/);
  });
  it("dedupes by item and skips invalid entries", () => {
    const out = validatePlacements(
      [
        { itemId: "a", x: 0, y: 0, w: 100, h: 100 },
        { itemId: "a", x: 50, y: 50, w: 100, h: 100 },
        { itemId: "", x: 0, y: 0, w: 100, h: 100 },
        null,
      ],
      canvas,
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(50);
  });
});
