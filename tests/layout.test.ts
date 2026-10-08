import { describe, expect, it } from "vitest";
import { PHOTO_MAX_SVH, SAVE_BAR_PAD } from "@/lib/layout";
import { BAND_H_EDITOR, BAND_H_RESULT, BAND_STAGGER_S, INK, PAPER, VERMILION } from "@/lib/brand";

describe("result fold tokens", () => {
  it("caps the photo at 45svh and uses stacked band heights", () => {
    expect(PHOTO_MAX_SVH).toBe("45svh");
    expect(SAVE_BAR_PAD).toContain("6.5rem");
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
