import { describe, expect, it } from "vitest";
import { COMPACT_MAX_HEIGHT_PX, PHOTO_MAX_SVH, SAVE_BAR_PAD } from "@/lib/layout";

describe("result fold tokens", () => {
  it("caps the photo at 45svh and compact-breaks at 700px", () => {
    expect(PHOTO_MAX_SVH).toBe("45svh");
    expect(COMPACT_MAX_HEIGHT_PX).toBe(700);
    expect(SAVE_BAR_PAD).toContain("6rem");
  });
});
