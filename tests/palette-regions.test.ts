import { describe, expect, it } from "vitest";
import { hexToFamily } from "@/lib/colors";
import { deltaE76, hexToLab, MIN_ROLE_DELTA_E, pairwiseRoleDeltaE } from "@/lib/color-distance";
import { assignRoles, isSkyLike, MIN_ROLE_PATCH, type PaletteSwatch } from "@/lib/palette-extract";
import { REGION_ORIGIN } from "@/lib/derived-roles";
import { emptyRoles } from "@/lib/tokens";

function region(hex: string, patch: number, overrides: Partial<PaletteSwatch> = {}): PaletteSwatch {
  return { origin: REGION_ORIGIN, hex, patch, share: patch, pinX: 0.5, pinY: 0.5,
    lab: hexToLab(hex), score: patch, family: hexToFamily(hex), name: hex,
    role: null, ...overrides };
}

function assertRealAndDistinct(input: PaletteSwatch[], selected: PaletteSwatch[]) {
  const roles = emptyRoles();
  for (const swatch of selected) {
    expect(input).toContain(swatch);
    expect(swatch.origin).toBe(REGION_ORIGIN);
    expect(swatch.patch).toBeGreaterThanOrEqual(MIN_ROLE_PATCH);
    roles[swatch.role!] = swatch.hex;
  }
  for (const pair of pairwiseRoleDeltaE(roles)) expect(pair.deltaE).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
}

describe("real region merge and refill", () => {
  it("keeps the dominant representative and refills from the next distinct component", () => {
    const rows = [region("#d9ce99", 0.1, { score: 0.8 }), region("#d2d0a8", 0.4),
      region("#e3d8b6", 0.04), region("#bcbcbc", 0.15),
      region("#161616", 0.03), region("#ffffff", 0.06), region("#28614b", 0.02)];
    const snapshot = rows.map((s) => ({ hex: s.hex, pinX: s.pinX, pinY: s.pinY }));
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "primary")).toBe(rows[1]);
    expect(selected).not.toContain(rows[0]);
    expect(selected).not.toContain(rows[2]);
    expect(selected.find((s) => s.hex === "#28614b")).toBeDefined();
    expect(selected).toHaveLength(5);
    expect(rows.map((s) => ({ hex: s.hex, pinX: s.pinX, pinY: s.pinY }))).toEqual(snapshot);
    assertRealAndDistinct(rows, selected);
  });

  it("leaves freed roles empty when all remaining components are near-duplicates", () => {
    const rows = [region("#d9ce99", 0.1), region("#d2d0a8", 0.4), region("#e3d8b6", 0.04)];
    const selected = assignRoles(rows);
    expect(selected).toEqual([rows[1]]);
    assertRealAndDistinct(rows, selected);
  });

  it("does not fill from a tiny but distinct boundary/noise patch", () => {
    const rows = [region("#d2d0a8", 0.4), region("#ff00ff", MIN_ROLE_PATCH / 2)];
    const selected = assignRoles(rows);
    expect(selected).toEqual([rows[0]]);
    assertRealAndDistinct(rows, selected);
  });

  it("handles nontransitive colour neighbours without leaving a close pair", () => {
    const rows = [region("#999999", 0.3), region("#aaaaaa", 0.2), region("#bbbbbb", 0.1)];
    expect(deltaE76(rows[0].lab, rows[1].lab)).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(deltaE76(rows[1].lab, rows[2].lab)).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(deltaE76(rows[0].lab, rows[2].lab)).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    const selected = assignRoles(rows);
    expect(selected).toHaveLength(2);
    expect(selected).toEqual([rows[0], rows[2]]);
    assertRealAndDistinct(rows, selected);
  });
});

describe("subject primary", () => {
  const skySpatial = { touchesTop: true, borderEdges: 3, upperShare: 0.95, centralShare: 0.05, texture: 1 };

  it("down-weights smooth top-edge sky even when it is the largest, highest-score region", () => {
    const sky = region("#3f5e92", 0.6, { pinY: 0.12, spatial: skySpatial });
    const facade = region("#d2d0a8", 0.25);
    const rows = [sky, facade, region("#111111", 0.02)];
    const selected = assignRoles(rows);
    expect(isSkyLike(sky)).toBe(true);
    expect(selected.find((s) => s.role === "primary")).toBe(facade);
    expect(selected).toContain(sky);
    assertRealAndDistinct(rows, selected);
  });

  it("uses a neutral subject when the only chromatic region is sky", () => {
    const sky = region("#7caed5", 0.7, { spatial: skySpatial });
    const subject = region("#888888", 0.2);
    expect(assignRoles([sky, subject, region("#111111", 0.02)])
      .find((s) => s.role === "primary")).toBe(subject);
  });

  it("leaves primary empty when no distinct subject colour remains", () => {
    const sky = region("#3f5e92", 0.6, { spatial: skySpatial });
    const rows = [sky, region("#111111", 0.02)];
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "primary")).toBeUndefined();
    expect(selected).toContain(sky);
    assertRealAndDistinct(rows, selected);
  });

  it("down-weights a border backdrop and keeps a central red subject primary", () => {
    const backdrop = region("#c5d9e8", 0.6, { spatial: { ...skySpatial, touchesTop: false, upperShare: 0.2 } });
    const red = region("#85232b", 0.25);
    expect(assignRoles([backdrop, red, region("#111111", 0.02)])
      .find((s) => s.role === "primary")).toBe(red);
  });

  it("does not promote a colourful border backdrop over a neutral subject", () => {
    const backdrop = region("#ca719d", 0.7, { spatial: { ...skySpatial, touchesTop: false, upperShare: 0.2 } });
    const subject = region("#888888", 0.2);
    expect(assignRoles([backdrop, subject, region("#111111", 0.02)])
      .find((s) => s.role === "primary")).toBe(subject);
  });

  it("does not consume a central red subject as text when no dark detail exists", () => {
    const red = region("#85232b", 0.3);
    expect(assignRoles([red, region("#bcbcbc", 0.4)])
      .find((s) => s.role === "primary")).toBe(red);
  });

  it("recognises very light smooth top-edge clouds as sky", () => {
    const cloud = region("#f2f4f7", 0.7, { spatial: skySpatial });
    const facade = region("#d2d0a8", 0.2);
    expect(isSkyLike(cloud)).toBe(true);
    expect(assignRoles([cloud, facade]).find((s) => s.role === "primary")).toBe(facade);
  });

  it.each([
    { ...skySpatial, touchesTop: false },
    { ...skySpatial, texture: 12 },
    { ...skySpatial, upperShare: 0.2 },
  ])("keeps blue subject regions eligible when they lack sky geometry/texture (%#)", (spatial) => {
    const blue = region("#426093", 0.5, { spatial: { ...spatial, borderEdges: 0, centralShare: 0.8 } });
    expect(isSkyLike(blue)).toBe(false);
    expect(assignRoles([blue, region("#d2d0a8", 0.1), region("#111111", 0.02)])
      .find((s) => s.role === "primary")).toBe(blue);
  });
});
