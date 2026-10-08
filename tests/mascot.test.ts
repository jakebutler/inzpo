import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  HANDOFF_KITS,
  MASCOT_CHEW_COPY_MS,
  MASCOT_COPY,
  MASCOT_POSES,
  MASCOT_SIZE_PX,
  MASCOT_WAIT_MS,
  copyForMoment,
  creamKit,
  kitForPose,
  kitFromColors,
  kitHasPalette,
  poseForMoment,
  stripeCssVars,
  stripeFills,
  waitBeforeShow,
} from "@/lib/mascot";
import { BAKU_STRIPE_DS, BAKU_STRIPE_VARS, bakuPlaceholderBytes, bakuSvgMarkup } from "@/lib/mascot-svg";

describe("Baku poses and moments", () => {
  it("has idle, chewing, success, empty, error-brief, and error-unreadable", () => {
    expect([...MASCOT_POSES]).toEqual([
      "idle",
      "chewing",
      "success",
      "empty",
      "error-brief",
      "error-unreadable",
    ]);
  });

  it("maps moments to poses", () => {
    expect(poseForMoment("first-open")).toBe("idle");
    expect(poseForMoment("upload")).toBe("chewing");
    expect(poseForMoment("brief")).toBe("chewing");
    expect(poseForMoment("empty")).toBe("empty");
    expect(poseForMoment("success")).toBe("success");
    expect(poseForMoment("error-brief")).toBe("error-brief");
    expect(poseForMoment("error-unreadable")).toBe("error-unreadable");
  });

  it("delays only real waits: brief, uploads, and first open", () => {
    expect(waitBeforeShow("first-open")).toBe(true);
    expect(waitBeforeShow("upload")).toBe(true);
    expect(waitBeforeShow("brief")).toBe(true);
    expect(waitBeforeShow("empty")).toBe(false);
    expect(waitBeforeShow("success")).toBe(false);
    expect(waitBeforeShow("error-brief")).toBe(false);
    expect(waitBeforeShow("error-unreadable")).toBe(false);
    expect(MASCOT_WAIT_MS).toBe(300);
  });
});

describe("Baku copy", () => {
  it("uses the specified lines", () => {
    expect(copyForMoment("first-open")).toBe("This is Baku. It eats colors.");
    expect(copyForMoment("empty")).toBe("Nothing to chew on yet.");
    expect(copyForMoment("upload")).toBe("Chewing on it.");
    expect(copyForMoment("brief")).toBe("Chewing on it.");
    expect(copyForMoment("brief", MASCOT_CHEW_COPY_MS)).toBe(
      "Still chewing. Your colors are already here.",
    );
    expect(copyForMoment("success")).toBe("Saved. Baku is full.");
    expect(copyForMoment("error-brief")).toBe("Couldn't finish the notes. Your colors are fine.");
    expect(copyForMoment("error-unreadable")).toBe("Baku can't taste this one. Try another photo.");
  });

  it("switches the chew line after 15s", () => {
    expect(MASCOT_CHEW_COPY_MS).toBe(15_000);
    expect(copyForMoment("upload", 14_999)).toBe(MASCOT_COPY.chewing);
    expect(copyForMoment("upload", 15_000)).toBe(MASCOT_COPY["chewing-still"]);
  });
});

describe("stripe kit", () => {
  it("draws filled stripes in token order and skips empty roles", () => {
    expect(COLOR_ROLES).toEqual(["primary", "secondary", "accent", "background", "surface", "text"]);
    expect(BAKU_STRIPE_DS).toHaveLength(6);
    expect(BAKU_STRIPE_VARS).toEqual([
      "var(--baku-primary)",
      "var(--baku-secondary)",
      "var(--baku-accent)",
      "var(--baku-background)",
      "var(--baku-surface)",
      "var(--baku-text)",
    ]);
    const vars = stripeCssVars(HAND_OFF());
    expect(Object.keys(vars).filter((k) => k.startsWith("--baku-") && !k.includes("cream") && !k.includes("seam"))).toEqual(
      COLOR_ROLES.map((role) => `--baku-${role}`),
    );
    expect(stripeFills(HAND_OFF())).toHaveLength(6);
  });

  it("keeps the palette on error-brief and chewing/success", () => {
    const kit = HANDOFF_KITS.IMG_6505;
    expect(kitForPose("error-brief", kit)).toEqual(kit);
    expect(kitForPose("chewing", kit)).toEqual(kit);
    expect(kitForPose("success", kit)).toEqual(kit);
  });

  it("returns a cream coat with no stripes for idle, empty, and error-unreadable", () => {
    const kit = HANDOFF_KITS.IMG_6505;
    expect(kitForPose("error-unreadable", kit)).toEqual(creamKit());
    expect(kitForPose("empty", kit)).toEqual(creamKit());
    expect(kitForPose("idle", kit)).toEqual(creamKit());
    expect(kitHasPalette(kitForPose("error-unreadable", kit))).toBe(false);
    expect(kitHasPalette(kitForPose("error-brief", kit))).toBe(true);
    expect(stripeFills(creamKit())).toEqual([]);
  });

  it("leaves missing roles empty (IMG_6208 four swatches, no cream pad)", () => {
    const kit = kitFromColors([
      { hex: "#7fafd4", role: "primary" },
      { hex: "#a2afbd", role: "secondary" },
      { hex: "#384b5f", role: "background" },
      { hex: "#bec6cd", role: "text" },
    ]);
    expect(kit).toEqual(HANDOFF_KITS.IMG_6208);
    expect(kit.accent).toBeNull();
    expect(kit.surface).toBeNull();
    expect(stripeFills(kit)).toEqual(["#7fafd4", "#a2afbd", "#384b5f", "#bec6cd"]);
  });

  it("does not invent roles from unscoped swatches", () => {
    const kit = kitFromColors([{ hex: "#ff0000" }, { hex: "#00ff00" }]);
    expect(kit.primary).toBeNull();
    expect(kit.secondary).toBeNull();
    expect(kit.accent).toBeNull();
    expect(stripeFills(kit)).toEqual([]);
  });

  it("renders at 48px", () => {
    expect(MASCOT_SIZE_PX).toBe(48);
  });
});

describe("SVG placeholder size", () => {
  it("reports the inline SVG markup bytes", () => {
    const bytes = bakuPlaceholderBytes();
    expect(bytes).toBeGreaterThan(400);
    expect(bytes).toBe(new TextEncoder().encode(bakuSvgMarkup()).length);
    const gz = gzipSync(bakuSvgMarkup()).length;
    expect(gz).toBeLessThan(bytes);
  });
});

function HAND_OFF() {
  return HANDOFF_KITS.IMG_6505;
}
