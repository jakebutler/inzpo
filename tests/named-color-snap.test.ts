import { describe, expect, it } from "vitest";
import { hexToLab, MIN_ROLE_DELTA_E, roleDeltaE } from "@/lib/color-distance";
import { chipsDistinctFromRoles, snapNamedColors } from "@/lib/named-color-snap";
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
      { ...named[0], hex: siding.hex, source: "region", pinX: siding.pinX, pinY: siding.pinY },
    ]);
    expect(roleDeltaE(hexToLab(named[0].hex), hexToLab("#d1cb9e"))).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    expect(roleDeltaE(siding.lab, hexToLab("#d1cb9e"))).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(snapNamedColors(named, regions, new Set(["#85232b", "#d1cb9e"]))).toEqual([]);
  });

  it("keeps the label and replaces the model hex and pin with the nearest measured region", () => {
    const input = [{ ...named[0], pinX: 0.9, pinY: 0.8 }];
    expect(snapNamedColors(input, regions, ["#1c1b19", "#85232b"])).toEqual([
      { hex: "#c6c09a", label: "yellow siding", source: "region", pinX: 0.2, pinY: 0.3 },
    ]);
    expect(input[0]).toEqual({ ...named[0], pinX: 0.9, pinY: 0.8 });
  });

  it("keeps the first label when different model hexes snap to the same region", () => {
    expect(snapNamedColors([...named, { hex: "#eff0b4", label: "pale siding" }], regions, [])).toEqual([
      { hex: "#c6c09a", label: "yellow siding", source: "region", pinX: 0.2, pinY: 0.3 },
    ]);
  });

  it("ignores tiny patches even when they exactly match the model hex", () => {
    expect(snapNamedColors(named, [region("#e9e388", MIN_ROLE_PATCH / 2), region(siding.hex, MIN_ROLE_PATCH)], [])).toEqual([
      { hex: "#c6c09a", label: "yellow siding", source: "region", pinX: 0.2, pinY: 0.3 },
    ]);
    expect(snapNamedColors(named, [region("#e9e388", MIN_ROLE_PATCH / 2)], [])).toEqual([]);
  });

  it("hides a role's source region found by its pin when the hex has changed", () => {
    const sample = region("#778bae");
    const regionAtPin = (x: number, y: number) => x === 0.4 && y === 0.1 ? sample : undefined;
    expect(snapNamedColors([{ hex: sample.hex, label: "sky" }], [sample],
      [{ hex: "#1c1b19", pinX: 0.4, pinY: 0.1 }], { regionAtPin })).toEqual([]);
  });

  it("prefers an exact mean match over the stored pin", () => {
    const role = region("#426092");
    const chip = region("#778bae");
    expect(snapNamedColors([{ hex: chip.hex, label: "sky" }], [role, chip],
      [{ hex: role.hex, pinX: 0.4, pinY: 0.1 }], { regionAtPin: () => chip })).toHaveLength(1);
    expect(snapNamedColors([{ hex: role.hex, label: "sky" }], [role, chip], [role.hex])).toEqual([]);
  });

  it("hides adjacent sky components despite their large colour distance", () => {
    const spatial = { touchesTop: true, upperShare: 0.9, texture: 0, borderEdges: 1, centralShare: 0 };
    const role = { ...region("#426092"), spatial };
    const chip = { ...region("#778bae"), spatial };
    expect(roleDeltaE(role.lab, chip.lab)).toBeGreaterThan(12);
    const neighbours = new Map([[role, new Set([chip])], [chip, new Set([role])]]);
    expect(snapNamedColors([{ hex: chip.hex, label: "blue sky" }], [role, chip], [role.hex], { neighbours })).toEqual([]);
    expect(snapNamedColors([{ hex: chip.hex, label: "blue sky" }], [role, chip], [role.hex])).toHaveLength(1);
    const brick = region("#85232b");
    expect(snapNamedColors([{ hex: brick.hex, label: "brick" }], [role, brick], [role.hex],
      { neighbours: new Map([[role, new Set([brick])]]) })).toHaveLength(1);
  });

  it("groups adjacent chromatic hues including wraparound, and adjacent neutrals", () => {
    for (const [roleHex, chipHex] of [["#426092", "#778bae"], ["#333333", "#aaaaaa"], ["#e04050", "#70202e"]]) {
      const role = region(roleHex);
      const chip = region(chipHex);
      expect(snapNamedColors([{ hex: chip.hex, label: null }], [role, chip], [role.hex],
        { neighbours: new Map([[role, new Set([chip])]]) })).toEqual([]);
    }
    const neutral = region("#aaaaaa");
    const blue = region("#426092");
    expect(snapNamedColors([{ hex: neutral.hex, label: null }], [blue, neutral], [blue.hex],
      { neighbours: new Map([[blue, new Set([neutral])]]) })).toHaveLength(1);
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

describe("chipsDistinctFromRoles", () => {
  const sky = { hex: "#778bae", label: "blue sky", source: "region", pinX: 0.1, pinY: 0.1 };
  it("hides a chip once a filled role is dragged onto a near-identical sample", () => {
    expect(chipsDistinctFromRoles([sky], ["#7a8db0", "#050404"])).toEqual([]);
  });
  it("keeps a chip that stays distinct from every filled role", () => {
    expect(chipsDistinctFromRoles([sky], ["#426092", "#050404", "#d0c7b2"])).toEqual([sky]);
  });
  it("keeps chips when nothing is filled", () => {
    expect(chipsDistinctFromRoles([sky], [])).toEqual([sky]);
  });
});
