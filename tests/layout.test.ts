import { describe, expect, it } from "vitest";
import { PHOTO_FOLD_PX, PHOTO_FOLD_CSS, PHOTO_MAX_SVH, SAVE_BAR_PAD } from "@/lib/layout";
import { BAND_H_EDITOR, BAND_H_RESULT, BAND_STAGGER_S, INK, PAPER, PIN_LEADER_X, VERMILION, photoFoldHeight } from "@/lib/brand";

describe("result fold tokens", () => {
  it("clamps the photo frame and uses stacked band heights", () => {
    expect(PHOTO_FOLD_PX).toBe(337);
    expect(PHOTO_FOLD_CSS).toContain("max(100svh, 740px) - 442px");
    expect(photoFoldHeight(667)).toBe(298);
    expect(PHOTO_MAX_SVH).toBe("45svh");
    expect(PIN_LEADER_X).toBe(16);
    expect(SAVE_BAR_PAD).toContain("8.5rem");
    expect(BAND_H_RESULT).toBe(40);
    expect(BAND_H_EDITOR).toBe(56);
    expect(BAND_STAGGER_S * 6 + 0.32).toBeLessThan(1);
  });
});

describe("brand", () => {
  it("uses paper, ink, and vermilion", () => {
    expect(PAPER).toBe("#F3EEE4");
    expect(INK).toBe("#1C1B19");
    expect(VERMILION).toBe("#C9341F");
  });
});
