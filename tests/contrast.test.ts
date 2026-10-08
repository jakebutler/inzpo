import { describe, expect, it } from "vitest";
import { contrastLineCopy, contrastRatio, swatchHairline, swatchInk, textOnBackgroundContrast } from "@/lib/contrast";
import { emptyRoles } from "@/lib/tokens";

describe("swatchInk", () => {
  it("picks white or black at 4.5:1, preferring the stronger ratio", () => {
    expect(swatchInk("#000000")).toBe("#ffffff");
    expect(swatchInk("#ffffff")).toBe("#000000");
    expect(contrastRatio(swatchInk("#6b6656"), "#6b6656")).toBeGreaterThanOrEqual(4.5);
    expect(swatchHairline("#000000")).toContain("255");
    expect(swatchHairline("#ffffff")).toContain("0,0,0");
  });
});

describe("contrastLineCopy", () => {
  it("names the missing role instead of printing a ratio", () => {
    const roles = emptyRoles();
    expect(contrastLineCopy(roles)).toBe("Needs text and background colors to check contrast.");
    expect(contrastLineCopy({ ...roles, background: "#d1cda4" })).toBe("Needs a text color to check contrast.");
    expect(contrastLineCopy({ ...roles, text: "#0a0c0b" })).toBe("Needs a background color to check contrast.");
    const both = { ...roles, background: "#d1cda4", text: "#0a0c0b" };
    expect(textOnBackgroundContrast(both)).not.toBeNull();
    expect(contrastLineCopy(both)).toMatch(/^\d+\.\d:1$/);
  });
});

describe("band and save contrast", () => {
  it("labels a band with a kit color that passes 4.5:1, else ink or paper", async () => {
    const { bandLabelColor, saveControlColors } = await import("@/lib/contrast");
    const { INK, PAPER } = await import("@/lib/brand");
    const kit = { ...emptyRoles(), background: "#d1cda4", text: "#0a0c0b", primary: "#6b6656" };
    expect(contrastRatio(bandLabelColor("#d1cda4", kit), "#d1cda4")).toBeGreaterThanOrEqual(4.5);
    const save = saveControlColors("#6b6656", "#d1cda4");
    expect(contrastRatio(save.fill, "#d1cda4")).toBeGreaterThanOrEqual(3);
    expect([INK, PAPER, "#6b6656"]).toContain(save.fill);
  });
});
