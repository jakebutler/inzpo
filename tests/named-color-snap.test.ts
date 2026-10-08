import { describe, expect, it } from "vitest";
import { hexToLab, MIN_ROLE_DELTA_E, roleDeltaE } from "@/lib/color-distance";
import { snapNamedColors } from "@/lib/named-color-snap";
import { MIN_ROLE_PATCH } from "@/lib/palette-extract";

function region(hex: string, patch = 0.1, pinX = 0.2, pinY = 0.3) {
  return { hex, lab: hexToLab(hex), patch, pinX, pinY };
}

describe("named colour snapping", () => {
  const siding = region("#c6c09a");
  const regions = [region("#3c4952"), siding, region("#85232b")];
  const named = [{ hex: "#e9e388", label: "yellow siding" }];

  it("snaps IMG_6505 siding before hiding its near-duplicate primary", () => {
    expect(snapNamedColors(named, regions, [])).toEqual([
      { ...named[0], hex: siding.hex, pinX: siding.pinX, pinY: siding.pinY },
    ]);
    expect(roleDeltaE(hexToLab(named[0].hex), hexToLab("#d1cb9e"))).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    expect(roleDeltaE(siding.lab, hexToLab("#d1cb9e"))).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(snapNamedColors(named, regions, new Set(["#85232b", "#d1cb9e"]))).toEqual([]);
  });

  it("keeps the label and replaces the model hex and pin with the nearest measured region", () => {
    const input = [{ ...named[0], pinX: 0.9, pinY: 0.8 }];
    expect(snapNamedColors(input, regions, ["#1c1b19", "#85232b"])).toEqual([
      { hex: "#c6c09a", label: "yellow siding", pinX: 0.2, pinY: 0.3 },
    ]);
    expect(input[0]).toEqual({ ...named[0], pinX: 0.9, pinY: 0.8 });
  });

  it("keeps the first label when different model hexes snap to the same region", () => {
    expect(snapNamedColors([...named, { hex: "#eff0b4", label: "pale siding" }], regions, [])).toEqual([
      { hex: "#c6c09a", label: "yellow siding", pinX: 0.2, pinY: 0.3 },
    ]);
  });

  it("ignores tiny patches even when they exactly match the model hex", () => {
    expect(snapNamedColors(named, [region("#e9e388", MIN_ROLE_PATCH / 2), region(siding.hex, MIN_ROLE_PATCH)], [])).toEqual([
      { hex: "#c6c09a", label: "yellow siding", pinX: 0.2, pinY: 0.3 },
    ]);
    expect(snapNamedColors(named, [region("#e9e388", MIN_ROLE_PATCH / 2)], [])).toEqual([]);
  });

  it("drops every suggestion when there are no regions", () => {
    expect(snapNamedColors(named, [], [])).toEqual([]);
  });

  it("keeps a region exactly at the CIE76 distinctness threshold", () => {
    const filled = "#777777";
    const lab = hexToLab(filled);
    const boundary = { ...siding, lab: [lab[0] + MIN_ROLE_DELTA_E, lab[1], lab[2]] as typeof lab };
    expect(snapNamedColors(named, [boundary], [filled])).toHaveLength(1);
    expect(snapNamedColors(named, [{ ...boundary, lab: [lab[0] + 11.99, lab[1], lab[2]] }], [filled])).toEqual([]);
  });
});
