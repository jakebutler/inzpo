import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isNoopPinDrag, isNoopPinSample, PIN_NOOP_TOLERANCE_PX } from "@/lib/pin-drag";
import { markDerivedRoles, SAMPLED_ORIGIN } from "@/lib/derived-roles";
import { generatedKitTitle } from "@/lib/kit-name";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("isNoopPinDrag", () => {
  it("treats a drop on the same spot as a no-op", () => {
    expect(isNoopPinDrag({ x: 120, y: 80, nx: 0.4, ny: 0.3 }, { x: 120, y: 80, nx: 0.4, ny: 0.3 })).toBe(true);
    expect(isNoopPinDrag({ x: 120, y: 80 }, { x: 120 + PIN_NOOP_TOLERANCE_PX, y: 80 })).toBe(true);
    expect(isNoopPinDrag({ x: 120, y: 80 }, { x: 120 + PIN_NOOP_TOLERANCE_PX + 1, y: 80 })).toBe(false);
    expect(isNoopPinDrag(null, { x: 1, y: 1 })).toBe(false);
    expect(isNoopPinSample({ pinX: 0.4, pinY: 0.3 }, 0.4, 0.3)).toBe(true);
    expect(isNoopPinSample({ pinX: 0.4, pinY: 0.3 }, 0.4 + 0.0005, 0.3)).toBe(true);
    expect(isNoopPinSample({ pinX: 0.4, pinY: 0.3 }, 0.55, 0.3)).toBe(false);
    expect(isNoopPinSample(null, 0.4, 0.3)).toBe(false);
  });

  it("keeps a sampled role user-set instead of retagging it auto", () => {
    const rows = markDerivedRoles([
      { hex: "#7dafd5", role: "primary", pinX: 0.4, pinY: 0.4, origin: SAMPLED_ORIGIN },
      { hex: "#44758d", role: "secondary", pinX: 0.41, pinY: 0.41, origin: "extracted" },
    ]);
    const primary = rows.find((r) => r.role === "primary");
    const secondary = rows.find((r) => r.role === "secondary");
    expect(primary?.derivedFrom).toBeNull();
    expect(secondary?.derivedFrom).toBe("primary");
  });

  it("commits a real move at the source pixel and saves origin sampled", () => {
    const editor = src("app/components/TokenEditor.tsx");
    expect(editor).toContain("isNoopPinSample");
    expect(editor).toContain("sampleImagePixel");
    expect(editor).toContain("origins");
    expect(editor).toContain("SAMPLED_ORIGIN");
    expect(src("lib/item-tokens.ts")).toContain('origin: origins[c.role] === "sampled" ? "sampled"');
    expect(src("app/actions/tokens.ts")).toContain("origins");
  });
});

describe("generated kit title", () => {
  it("turns a ready brief into a persisted title, not Untitled kit", () => {
    expect(
      generatedKitTitle({
        title: null,
        briefText: "A yellow Victorian with a black door.",
        namedColors: [{ hex: "#e8c36a", label: "yellow siding" }],
      }),
    ).toBe("Yellow Victorian");
    expect(src("lib/brief.ts")).toContain("persistKitTitleFromBrief");
    expect(src("app/api/briefs/[id]/route.ts")).toContain("persistKitTitleFromBrief");
  });
});
