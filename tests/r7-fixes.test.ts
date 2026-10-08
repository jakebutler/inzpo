import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_STAGGER_S, PAPER } from "@/lib/brand";
import { MOTION } from "@/lib/motion";
import { HANDOFF_KITS } from "@/lib/mascot";
import { BRIEF_REQUEST } from "@/lib/brief-request";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("r7 reveal", () => {
  it("keeps bands hidden until the photo is decoded, then staggers 0.06s × 6 + 0.32s", () => {
    expect(BAND_STAGGER_S).toBe(0.06);
    expect(MOTION.enter.duration).toBe(0.32);
    const kit = src("app/components/KitResult.tsx");
    expect(kit).toContain("photoReady");
    expect(kit).toContain(".decode(");
    expect(kit).toContain("data-photo-lqip");
    expect(kit).toContain("fetchPriority");
    expect(kit).toContain("gsap.set(bands, { y: 8, opacity: 0 })");
    expect(kit).toContain("i * BAND_STAGGER_S");
    expect(kit).toContain("if (mode === \"play\" && !photoReady)");
    expect(kit).toContain("dependencies: [itemId, preview?.reveal, reduced, revealTick, photoReady]");
    expect(kit).not.toMatch(/claimRevealPlay\(itemId\)[\s\S]{0,200}revealNow\(\)/);
    expect(src("app/globals.css")).toMatch(/\[data-band-stack\]\[data-revealed="false"\] \.inzpo-band/);
  });
});

describe("r7 upload wait", () => {
  it("centers chewing with progress and disables Snap and Pick", () => {
    const form = src("app/capture/CaptureForm.tsx");
    expect(form).toContain("data-upload-wait");
    expect(form).toContain('align="center"');
    expect(form).toContain("disabled={uploading}");
    expect(form).toContain("MASCOT_SIZE_UPLOAD_PX");
    expect(src("lib/media.ts")).toContain("Promise.all");
    expect(BRIEF_REQUEST.visionEdgePx).toBe(384);
  });
});

describe("r7 recapture script", () => {
  it("writes r7_ stills including reveal frames and a no-op pin drag", () => {
    const shots = src("scripts/qa-shots-r7.mts");
    expect(shots).toContain("r7_");
    expect(shots).toContain("reveal${ms}ms");
    expect(shots).toContain("0, 100, 300, 600");
    expect(shots).toContain("noopPinDrag");
    expect(shots).toContain("data-upload-wait");
    expect(shots).not.toMatch(/r6_\$\{/);
  });
});

describe("r7 login polish", () => {
  it("uses Fraunces, pose PNG, and six real kit colors", () => {
    const login = src("app/login/SignInForm.tsx");
    expect(login).toContain("font-heading");
    expect(login).toContain("Enter your email and we'll send you a code.");
    expect(login).not.toContain("Enter the email your invite went to.");
    const idle = src("app/login/LoginIdleMark.tsx");
    expect(idle).toContain("forcePoseAsset");
    expect(idle).not.toContain("baku-glow");
    expect(idle).not.toContain("PAPER");
    expect(Object.values(HANDOFF_KITS.IMG_6505).every((hex) => hex.toLowerCase() !== PAPER.toLowerCase())).toBe(true);
  });
});
