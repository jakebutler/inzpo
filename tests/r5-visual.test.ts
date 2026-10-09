import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRIEF_SLOT_MIN_PX,
  PAGE_BAND_HAIRLINE,
  PAGE_BAND_HAIRLINE_RATIO,
  PHOTO_FOLD_CSS,
  PHOTO_FOLD_FLOOR_VH,
  PHOTO_FOLD_RESERVE_PX,
  PAPER,
  PIN_LEADER_X,
  photoFoldHeight,
} from "@/lib/brand";
import { contrastRatio, matchesPageBackground } from "@/lib/contrast";
import { displayBriefSlot } from "@/lib/brief-display";
import { AUTO_TAG, markDerivedRoles } from "@/lib/derived-roles";
import { clampPinCenter, mapCoverPinRaw, PIN_EDGE_MARGIN_PX } from "@/lib/cover-pin";
import { preferredHairline, segmentsCross, uncrossHairlines } from "@/lib/hairlines";
import { MOTION } from "@/lib/motion";
import { COLOR_ROLES } from "@/lib/db/schema";
import { HANDOFF_KITS, MASCOT_COPY, MASCOT_SIZE_BRIEF_PX, MASCOT_SIZE_PX } from "@/lib/mascot";
import { loadFoldKit } from "@/lib/fold-kit";
import { FOLD_BRIEFS } from "@/lib/fold-briefs";
import {
  BAKU_ART_POSES,
  BAKU_SHADOW_CLIP_PCT,
  bakuArtPose,
  bakuCanTint,
  bakuDensity,
  bakuV6BandMaskSrc,
  bakuV6BandsSrc,
  bakuV6ColorSrc,
  bakuV6PoseSrc,
} from "@/lib/baku-v6";
import { captureGuardIssues, cssRgbToHex, isAllowedCaptureBackground } from "@/lib/qa-capture-guard";
import { defringePremulEdges, grayToBandIndex, multiplyGrayByHex, multiplyShadowPixels, tintRoles } from "@/lib/baku-tint";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("r5 first paint bands", () => {
  it("hides bands until GSAP with opacity 0 and translateY(8px)", () => {
    const css = src("app/globals.css");
    expect(css).toMatch(/\[data-band-stack\]\[data-revealed="false"\] \.inzpo-band/);
    expect(css).toMatch(/opacity:\s*0/);
    expect(css).toMatch(/translateY\(8px\)/);
    const kit = src("app/components/KitResult.tsx");
    expect(kit).toContain("data-revealed");
    expect(kit).toContain("setBandsRevealed");
    expect(kit).toContain('mode === "hold"');
    expect(kit).toContain("MOTION.reduced.duration");
    expect(kit).toContain("gsap.set(bands, { y: 8, opacity: 0 })");
    expect(kit).toContain("i * BAND_STAGGER_S");
    expect(MOTION.reduced.duration).toBe(0.12);
    expect(src("app/components/TokenEditor.tsx")).toContain("bandsRevealed");
    expect(src("app/dev/fold/page.tsx")).toContain('hold === "1"');
  });
});

describe("r5 brief slot", () => {
  it("reserves 88px with chewing / idle / error-brief copy", () => {
    expect(BRIEF_SLOT_MIN_PX).toBe(88);
    expect(MASCOT_COPY.chewing).toBe("Chewing on it.");
    expect(MASCOT_COPY["error-brief-retry"]).toBe("Couldn't read this one. Tap to retry.");
    const brief = src("app/components/BriefSlot.tsx");
    expect(brief).toContain("BRIEF_SLOT_MIN_PX");
    expect(brief).toContain("error-brief");
    expect(brief).toContain('"idle"');
    expect(brief).toContain('"chewing"');
    expect(brief).not.toContain("line-clamp");
    expect(brief).not.toContain("WebkitLineClamp");
    expect(brief).not.toContain("-webkit-box");
    expect(brief).toContain("text-[18px] leading-6");
    expect(brief).toContain("data-brief-text");
  });

  it("shows the model sentence as-is without an ellipsis clamp", () => {
    const sentence =
      "Sky-blue mural facade with dark navy door insets and pale gray shopfront, evoking a quiet, storybook charm.";
    expect(sentence.length).toBe(107);
    expect(displayBriefSlot(sentence)).toBe(sentence);
    expect(src("app/components/BriefSlot.tsx")).not.toMatch(/overflow:\s*["']?hidden/);
    expect(src("lib/brief-prompt.ts")).toContain("Write one sentence of at most 12 words");
    expect(src("lib/brief-display.ts")).toContain("Never ellipsize");
  });
});

describe("r5 photo clamp", () => {
  it("uses 442px reserve and a 740px floor", () => {
    expect(PHOTO_FOLD_RESERVE_PX).toBe(442);
    expect(PHOTO_FOLD_FLOOR_VH).toBe(740);
    expect(PHOTO_FOLD_CSS).toBe("clamp(200px, max(100svh, 740px) - 442px, 337px)");
    expect(photoFoldHeight(844)).toBe(337);
    expect(photoFoldHeight(667)).toBe(298);
    expect(src("app/globals.css")).toContain("max(100svh, 740px) - 442px");
  });
});

describe("r5 derived auto tags", () => {
  it("marks tints and shared pins as auto, not sampled", () => {
    const rows = markDerivedRoles([
      { hex: HANDOFF_KITS.IMG_6505.background!, role: "background", pinX: 0.5, pinY: 0.4, position: 3 },
      { hex: HANDOFF_KITS.IMG_6505.accent!, role: "accent", pinX: 0.52, pinY: 0.41, position: 2 },
      { hex: HANDOFF_KITS.IMG_6505.primary!, role: "primary", pinX: 0.3, pinY: 0.6, position: 0 },
      { hex: HANDOFF_KITS.IMG_6505.secondary!, role: "secondary", pinX: 0.31, pinY: 0.61, position: 1 },
      { hex: HANDOFF_KITS.IMG_6505.surface!, role: "surface", pinX: 0.33, pinY: 0.55, position: 4 },
      { hex: HANDOFF_KITS.IMG_6505.text!, role: "text", pinX: 0.2, pinY: 0.8, position: 5 },
    ]);
    const auto = rows.filter((r) => r.derivedFrom).map((r) => r.role);
    const sampled = rows.filter((r) => !r.derivedFrom).map((r) => r.role);
    expect(sampled).toContain("background");
    expect(sampled).toContain("text");
    expect(auto.length).toBeGreaterThanOrEqual(2);
    expect(AUTO_TAG).toBe("auto");
    expect(src("app/components/PaletteBands.tsx")).toContain("inzpo-band-auto");
    expect(src("app/globals.css")).toMatch(/\.inzpo-band-auto[\s\S]*font-size:\s*11px/);
    expect(src("app/globals.css")).toMatch(/\.inzpo-band-auto[\s\S]*opacity:\s*0\.6/);
    expect(src("app/components/TokenEditor.tsx")).toContain("onPromoteRole");
    expect(src("app/components/TokenEditor.tsx")).toContain("photoBox.w / 2");
  });

  it("keeps real fold palette gaps rather than padding every role", async () => {
    for (const id of ["IMG_6505", "IMG_6208", "IMG_5859"] as const) {
      const kit = await loadFoldKit(id);
      const roles = kit.colors.map((c) => c.role);
      expect(roles.length).toBeGreaterThan(0);
      expect(new Set(roles).size).toBe(roles.length);
      expect(roles.every((role) => COLOR_ROLES.includes(role))).toBe(true);
      if (id === "IMG_6505") {
        expect(roles).not.toContain('accent');
        expect(roles).not.toContain('surface');
      }
    }
  });
});

describe("r5 pin edge clamp", () => {
  it("keeps disc centers 16px from edges plus safe-area top", () => {
    expect(PIN_EDGE_MARGIN_PX).toBe(16);
    const raw = mapCoverPinRaw(0.5, 0.0, 100, 100, 390, 337);
    expect(raw).not.toBeNull();
    const clamped = clampPinCenter(raw!.left * 390, raw!.top * 337, 390, 337, 47);
    expect(clamped.y).toBeGreaterThanOrEqual(16 + 47);
    expect(clamped.x).toBeGreaterThanOrEqual(16);
    expect(clamped.x).toBeLessThanOrEqual(390 - 16);
  });
});

describe("r5 hairlines and back", () => {
  it("tracks the live band left inset and stays off until the band is on screen", () => {
    const onScreen = { left: 4, top: 70, right: 390, bottom: 110, visible: true };
    const line = preferredHairline(80, 10, onScreen, PIN_LEADER_X);
    expect(line).toEqual({ x1: 80, y1: 10, x2: 4 + PIN_LEADER_X, y2: 90 });
    expect(preferredHairline(80, 10, { ...onScreen, visible: false })).toBeNull();
  });

  it("uncrosses overlapping leaders by landing on the nearest band point", () => {
    const crossed = uncrossHairlines(
      [
        { x1: 80, y1: 10, x2: 16, y2: 80 },
        { x1: 80, y1: 90, x2: 16, y2: 20 },
      ],
      [
        { x: 16, y: 70 },
        { x: 16, y: 30 },
      ],
    );
    expect(segmentsCross(crossed[0]!, crossed[1]!)).toBe(false);
    expect(crossed[0]!.y2).not.toBe(80);
    expect(src("app/components/KitResult.tsx")).toContain("syncHairlines");
  });

  it("places the back button below the safe area and on the collection page", () => {
    expect(src("app/components/PhotoBackButton.tsx")).toContain("env(safe-area-inset-top, 0px) + 8px");
    expect(src("app/dev/fold/page.tsx")).toContain('placement="header"');
    expect(src("app/page.tsx")).toContain('<PhotoBackButton href="/" placement="header" />');
    expect(src("app/page.tsx")).toContain('href="/capture"');
  });
});

describe("r5 background hairline", () => {
  it("uses 12% ink only when contrast against the page is under 1.2:1", () => {
    expect(PAGE_BAND_HAIRLINE).toBe("rgba(28, 27, 25, 0.12)");
    expect(PAGE_BAND_HAIRLINE_RATIO).toBe(1.2);
    expect(matchesPageBackground(PAPER, PAPER)).toBe(true);
    expect(contrastRatio("#d1cda4", PAPER)).toBeGreaterThan(1.2);
    expect(src("app/components/PaletteBands.tsx")).toContain("PAGE_BAND_HAIRLINE");
  });
});

describe("r5 shots", () => {
  it("writes r5_ stills including hold, failed, edit-drag, and collection", () => {
    const shots = src("scripts/qa-shots-fold.mts");
    expect(shots).toContain("r5_");
    expect(shots).not.toMatch(/r4_\$\{/);
    expect(shots).toContain("reveal0ms");
    expect(shots).toContain("edit-drag");
    expect(shots).toContain("hold=1");
    expect(shots).toContain('state: "failed"');
    expect(shots).toContain("r5_flow_");
    expect(shots).toContain("brief-closeup");
    expect(shots).toContain("brief-closeup-navy");
    expect(shots).toContain("brief-closeup-light");
    expect(shots).toContain("brief-full");
    expect(shots).toContain("assertCaptureReady");
    expect(shots).toContain("document.fonts.check");
    expect(shots).toContain("/_next/static");
    expect(shots).toContain("__next_error__");
    expect(shots).toContain("documentStatus");
    expect(shots).toContain("clip:");
    expect(shots).toContain("data-baku-shadow-baked");
    expect(shots).toContain("empty-collection");
    expect(shots).toContain('state: "pending"');
    expect(shots).toContain("arrived_");
    expect(shots).toContain('state: "saved"');
    expect(shots).not.toContain('ABOVE_BAR = new Set(["pending"');
  });
});

describe("r5 baku v6 art", () => {
  it("keeps v6 paths, maps error-unreadable to error-photo, and tints knit poses only", () => {
    expect(bakuArtPose("error-unreadable")).toBe("error-photo");
    expect(bakuCanTint("idle")).toBe(true);
    expect(bakuCanTint("empty")).toBe(false);
    expect(bakuCanTint("error-unreadable")).toBe(false);
    expect(bakuDensity(1)).toBe(1);
    expect(bakuDensity(2)).toBe(2);
    expect(bakuDensity(3)).toBe(3);
    expect(bakuV6ColorSrc("idle", 2)).toBe("/baku/v6/baku-idle-color@2x.png");
    expect(bakuV6BandsSrc("success", 3)).toBe("/baku/v6/baku-success-bands@3x.png");
    expect(bakuV6BandMaskSrc("error-brief", "text")).toBe("/baku/v6/baku-error-brief-band6@1x.png");
    expect(bakuV6PoseSrc("error-unreadable", 1)).toBe("/baku/v6/baku-error-photo@1x.png");
    expect(grayToBandIndex(40)).toBe(0);
    expect(grayToBandIndex(240)).toBe(5);
    expect(grayToBandIndex(0)).toBeNull();
    expect(multiplyGrayByHex(255, 255, 255, "#664422")).toEqual([0x66, 0x44, 0x22]);
    expect(tintRoles(HAND_OFF(), 2).filter(Boolean)).toHaveLength(2);
    expect(MASCOT_SIZE_PX).toBe(48);
    expect(MASCOT_SIZE_BRIEF_PX).toBe(56);
    expect(BAKU_SHADOW_CLIP_PCT).toBe(10.5);
    const brief = src("app/components/BriefSlot.tsx");
    expect(brief).toMatch(/size=\{MASCOT_SIZE_BRIEF_PX\}/);
    expect(brief).not.toMatch(/size=\{MASCOT_SIZE_PX\}/);
    expect(brief).toContain("alignItems: \"flex-end\"");
    const sprite = src("app/components/BakuSprite.tsx");
    expect(sprite).toContain("onError");
    expect(sprite).toContain("bakuDensity");
    expect(sprite).toContain("scaleX(-1)");
    expect(sprite).toContain("50% 100%");
    expect(sprite).toContain("multiplyShadowPixels");
    expect(sprite).toContain("bakeShadow");
    expect(sprite).toContain("data-baku-shadow");
    expect(sprite).toContain("data-baku-shadow-baked");
    expect(sprite).toContain("BAKU_SHADOW_CLIP_PCT");
    expect(sprite).toContain('const flip = faceText && showPng ? "scaleX(-1)" : undefined');
    expect(sprite).not.toMatch(/data-baku-sprite[\s\S]{0,400}transform: faceText && showPng/);
    expect(sprite).not.toContain("mixBlendMode");
    expect(sprite).toContain("defringePremulEdges");
    const fringe = new Uint8ClampedArray([243, 234, 216, 80, 56, 75, 95, 255]);
    defringePremulEdges(fringe, 2, 1, 4);
    expect(fringe[0]).toBe(56);
    expect(fringe[1]).toBe(75);
    expect(fringe[2]).toBe(95);
    const cream = new Uint8ClampedArray([233, 221, 212, 255]);
    multiplyShadowPixels(cream, 1, 1, 4, "#384b5f", 100);
    expect(cream[0]).toBeLessThan(60);
    expect(cream[1]).toBeLessThan(80);
    expect(cream[2]).toBeLessThan(90);
    expect(sprite).not.toMatch(/probe\(/);
    expect(src("app/components/mascot.css")).not.toMatch(/width:\s*48px/);
  });

  it("installs approved v6 PNGs and keeps review sheets out of public", () => {
    const dir = path.join(process.cwd(), "public/baku/v6");
    const names = readdirSync(dir);
    expect(names).not.toContain("_preview.png");
    expect(names).not.toContain("_overlay.png");
    expect(existsSync(path.join(process.cwd(), "docs/baku/_preview.png"))).toBe(true);
    for (const pose of BAKU_ART_POSES) {
      for (const d of [1, 2, 3] as const) {
        expect(existsSync(path.join(dir, `baku-${pose}@${d}x.png`))).toBe(true);
      }
    }
    expect(existsSync(path.join(dir, "baku-idle-bands@3x.png"))).toBe(true);
    expect(existsSync(path.join(dir, "baku-idle-band1@1x.png"))).toBe(true);
    expect(existsSync(path.join(dir, "baku-empty-bands@1x.png"))).toBe(false);
    expect(src("app/components/Mascot.tsx") + src("app/components/BakuSprite.tsx")).not.toMatch(/baku\/v5/);
  });

  it("multiplies knit pixels from the index mask", async () => {
    const sharp = (await import("sharp")).default;
    const sprite = await sharp(path.join(process.cwd(), "public/baku/v6/baku-idle@1x.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const bands = await sharp(path.join(process.cwd(), "public/baku/v6/baku-idle-bands@1x.png"))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = new Uint8ClampedArray(sprite.data);
    const mask = new Uint8ClampedArray(bands.data);
    const { tintSpriteWithBands } = await import("@/lib/baku-tint");
    tintSpriteWithBands(pixels, mask, 48, 48, 4, bands.info.channels, ["#ff0000", null, null, null, null, null]);
    let tinted = 0;
    for (let i = 0; i < mask.length; i += bands.info.channels) {
      if (mask[i] !== 40) continue;
      const p = (i / bands.info.channels) * 4;
      expect(pixels[p + 1]).toBe(0);
      expect(pixels[p + 2]).toBe(0);
      tinted += 1;
    }
    expect(tinted).toBeGreaterThan(20);
  });
});

function HAND_OFF() {
  return HANDOFF_KITS.IMG_6505;
}

describe("r5 capture guard", () => {
  it("rejects unstyled white pages and missing fonts or CSS", () => {
    expect(cssRgbToHex("rgb(243, 238, 228)")).toBe("#f3eee4");
    expect(isAllowedCaptureBackground("#f3eee4", { kitWear: false })).toBe(true);
    expect(isAllowedCaptureBackground("#ffffff", { kitWear: true })).toBe(false);
    expect(isAllowedCaptureBackground("#384b5f", { kitWear: true })).toBe(true);
    expect(
      captureGuardIssues({
        staticFails: ["404 /_next/static/css/app/layout.css"],
        sheetCount: 0,
        ruleCount: 0,
        backgroundHex: "#ffffff",
        kitWear: true,
        fraunces: false,
        geist: false,
      }).length,
    ).toBeGreaterThan(3);
    expect(
      captureGuardIssues({
        staticFails: [],
        sheetCount: 2,
        ruleCount: 40,
        backgroundHex: "#384b5f",
        kitWear: true,
        fraunces: true,
        geist: true,
      }),
    ).toEqual([]);
    expect(
      captureGuardIssues({
        staticFails: [],
        sheetCount: 2,
        ruleCount: 40,
        backgroundHex: "#f3eee4",
        kitWear: false,
        fraunces: true,
        geist: true,
        documentStatus: 500,
        errorDocument: true,
      }),
    ).toEqual(["document HTTP 500", "Next.js error document"]);
  });
});

describe("r5 briefs from file", () => {
  it("keeps captured model text and wires --from", () => {
    expect(FOLD_BRIEFS.IMG_6505.latencyMs).toBe(14096);
    expect(FOLD_BRIEFS.IMG_6208.latencyMs).toBe(5177);
    expect(FOLD_BRIEFS.IMG_5859.latencyMs).toBe(4430);
    expect(FOLD_BRIEFS.IMG_6505.text.startsWith("Pale butter-yellow")).toBe(true);
    expect(src("scripts/run-fold-briefs.mts")).toContain("--from");
    expect(src("scripts/run-fold-briefs.mts")).toContain("BRIEF_REQUEST");
  });
});
