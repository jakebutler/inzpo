import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHIP_SWATCH_PX,
  PHOTO_FOLD_CSS,
  PHOTO_FOLD_MIN_PX,
  PHOTO_FOLD_PX,
  PHOTO_FOLD_RESERVE_PX,
  PIN_INNER_RING_PX,
  PIN_OUTER_RING_PX,
  PIN_SHADOW,
  PIN_SIZE,
  photoFoldHeight,
  pinDiscStyle,
  PAPER,
  INK,
} from "@/lib/brand";
import { SNAP_SCROLL_PAD } from "@/lib/layout";
import { claimRevealPlay, planReveal, resetReveal, revealHasPlayed } from "@/lib/reveal";
import {
  BAKU_BAND_GRAYS,
  BAKU_V6_DIR,
  bakuV6BandGray,
  bakuV6BandMaskSrc,
  bakuV6BandsSrc,
  bakuV6PoseSrc,
} from "@/lib/baku-v6";
import { pointerOnCoverBox, coverWindow } from "@/lib/cover-pin";
import { saveControlColors, contrastRatio } from "@/lib/contrast";
import { MASCOT_SUCCESS_HOLD_MS } from "@/lib/mascot";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("r4 pins", () => {
  it("uses a 22px fill with paper and ink rings and a contact shadow", () => {
    expect(PIN_SIZE).toBe(22);
    expect(PIN_INNER_RING_PX).toBe(2);
    expect(PIN_OUTER_RING_PX).toBe(1.5);
    expect(PIN_SHADOW).toBe("0 1px 2px rgba(0,0,0,.25)");
    const style = pinDiscStyle("#ccc5b3");
    expect(style.backgroundColor).toBe("#ccc5b3");
    expect(style.border).toBe(`2px solid ${PAPER}`);
    expect(style.outline).toBe(`1.5px solid ${INK}`);
    expect(style.boxShadow).toBe(PIN_SHADOW);
  });

  it("keeps chip swatches at 20px, not the pin size", () => {
    expect(CHIP_SWATCH_PX).toBe(20);
    expect(CHIP_SWATCH_PX).not.toBe(PIN_SIZE);
    expect(src("app/components/TokenEditor.tsx")).toContain("CHIP_SWATCH_PX");
    expect(src("app/components/TokenEditor.tsx")).not.toMatch(/width: PIN_SIZE/);
  });
});

describe("r4 photo fold", () => {
  it("clamps the photo to 337px at 844 and does not shrink further below 740px", () => {
    expect(PHOTO_FOLD_MIN_PX).toBe(200);
    expect(PHOTO_FOLD_RESERVE_PX).toBe(442);
    expect(PHOTO_FOLD_CSS).toBe("clamp(200px, max(100svh, 740px) - 442px, 337px)");
    expect(photoFoldHeight(667)).toBe(298);
    expect(photoFoldHeight(844)).toBe(PHOTO_FOLD_PX);
    expect(photoFoldHeight(500)).toBe(298);
  });
});

describe("r4 reveal once per kit id", () => {
  it("plays the first time and lands after that", () => {
    const store = new Set<string>();
    expect(planReveal("kit-a", "play", store)).toBe("play");
    expect(planReveal("kit-a", "play", store)).toBe("land");
    expect(planReveal("kit-b", "play", store)).toBe("play");
    expect(planReveal("kit-a", "mid", store)).toBe("mid");
    expect(planReveal("kit-a", "landed", store)).toBe("land");
    expect(planReveal("kit-a", "hold", store)).toBe("hold");
    expect(revealHasPlayed("kit-a", store)).toBe(true);
  });

  it("does not restart when claimRevealPlay is called again for the same id", () => {
    resetReveal();
    expect(claimRevealPlay("fold-IMG_6505")).toBe(true);
    expect(claimRevealPlay("fold-IMG_6505")).toBe(false);
    expect(claimRevealPlay("fold-IMG_6208")).toBe(true);
    resetReveal("fold-IMG_6505");
    expect(claimRevealPlay("fold-IMG_6505")).toBe(true);
    resetReveal();
  });
});

describe("r4 baku v6", () => {
  it("loads v6 PNGs and band masks, never v5", () => {
    expect(BAKU_V6_DIR).toBe("/baku/v6");
    expect(bakuV6PoseSrc("chewing", 2)).toBe("/baku/v6/baku-chewing@2x.png");
    expect(bakuV6BandsSrc("chewing")).toBe("/baku/v6/baku-chewing-bands@1x.png");
    expect(bakuV6BandsSrc("chewing", 3)).toBe("/baku/v6/baku-chewing-bands@3x.png");
    expect(bakuV6BandMaskSrc("chewing", "primary")).toBe("/baku/v6/baku-chewing-band1@1x.png");
    expect(BAKU_BAND_GRAYS).toEqual([40, 80, 120, 160, 200, 240]);
    expect(bakuV6BandGray("text")).toBe(240);
    const mascot = src("app/components/Mascot.tsx") + src("app/components/BakuSprite.tsx") + src("lib/baku-v6.ts");
    expect(mascot).not.toMatch(/baku\/v5/);
    expect(src("app/components/BriefSlot.tsx")).toContain("faceText");
  });
});

describe("r4 loupe and cover sampling", () => {
  it("maps a pointer on the cover box back to source coordinates", () => {
    const win = coverWindow(100, 100, 100, 100);
    expect(win).not.toBeNull();
    const mapped = pointerOnCoverBox(50, 50, { left: 0, top: 0, width: 100, height: 100 }, win!);
    expect(mapped).toEqual({ x: 50, y: 50, nx: 0.5, ny: 0.5 });
  });

  it("keeps the loupe on the photo, not a sheet thumbnail", () => {
    const editor = src("app/components/TokenEditor.tsx");
    expect(editor).not.toContain("max-h-56");
    expect(editor).toContain("overlayClassName");
    expect(src("app/components/PhotoLoupe.tsx")).toContain("LOUPE_PX");
  });
});

describe("r4 save contrast and copy", () => {
  it("uses ink on a mid fill when paper misses 4.5:1", () => {
    const save = saveControlColors("#85826B", "#1C1B19");
    expect(save.fill).toBe("#85826B");
    expect(save.ink).toBe(INK);
    expect(contrastRatio(PAPER, save.fill)).toBeLessThan(4.5);
    expect(contrastRatio(INK, save.fill)).toBeGreaterThan(contrastRatio(PAPER, save.fill));
  });

  it("holds the saved caption for 2s and does not replace the brief", () => {
    expect(MASCOT_SUCCESS_HOLD_MS).toBe(2000);
    const brief = src("app/components/BriefSlot.tsx");
    expect(brief).toContain("SavedCaption");
    expect(brief).toContain("font-heading");
  });

  it("does not flash Save to New collection", () => {
    const bar = src("app/components/SaveBar.tsx");
    expect(bar).toContain("Save to collection");
    expect(bar).toContain("disabled:opacity-100");
    expect(bar).not.toContain('|| "New collection"');
  });
});

describe("r4 first screen pad", () => {
  it("pads the scroll area by the Snap bar plus 16px", () => {
    expect(SNAP_SCROLL_PAD).toContain("8.5rem + 1rem");
    expect(src("app/capture/CaptureForm.tsx")).toContain("SNAP_SCROLL_PAD");
    expect(src("app/capture/CaptureForm.tsx")).toContain("BAR_FADE");
  });
});
