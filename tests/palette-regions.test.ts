import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { hexToFamily } from "@/lib/colors";
import { deltaE76, hexToLab, MIN_ROLE_DELTA_E, pairwiseRoleDeltaE } from "@/lib/color-distance";
import { assignRoles, extractPalette, isShadowRegion, isSkyLike, MIN_ROLE_PATCH, type PaletteSwatch } from "@/lib/palette-extract";
import { contrastRatio } from "@/lib/contrast";
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

describe("background eligibility", () => {
  it("prefers the largest L* >= 75 region over a larger passing mid-grey", () => {
    const grey = region("#aeada5", 0.4);
    const cream = region("#d0c7b2", 0.1);
    const text = region("#060504", 0.01);
    const rows = [region("#85232b", 0.3), grey, cream, region("#eeeeee", 0.02), text];
    expect(grey.lab[0]).toBeLessThan(75);
    expect(cream.lab[0]).toBeGreaterThanOrEqual(75);
    expect(contrastRatio(grey.hex, text.hex)).toBeGreaterThanOrEqual(4.5);
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "background")).toBe(cream);
    assertRealAndDistinct(rows, selected);
  });

  it.each([false, true])("falls back to the largest passing light/neutral when the bright tier is unavailable (conflicting trim: %s)", (conflictingTrim) => {
    const grey = region("#aeada5", 0.2);
    const subject = region(conflictingTrim ? "#d2d0a8" : "#85232b", 0.4);
    const rows = [subject, grey, region("#888888", 0.1), region("#060504", 0.01)];
    if (conflictingTrim) rows.push(region("#e3d8b6", 0.1));
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "primary")).toBe(subject);
    expect(selected.find((s) => s.role === "background")).toBe(grey);
    assertRealAndDistinct(rows, selected);
  });

  it("picks the largest passing light/neutral component ahead of a higher score or brighter detail", () => {
    const facade = region("#d2d0a8", 0.4);
    const cream = region("#d5cfbe", 0.2);
    const rows = [facade, cream, region("#eeeeee", 0.08, { score: 10 }),
      region("#050404", 0.01), region("#303030", 0.02)];
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "primary")).toBe(facade);
    expect(selected.find((s) => s.role === "background")).toBe(cream);
    expect(selected.find((s) => s.role === "text")).toBe(rows[3]);
    expect(contrastRatio(cream.hex, rows[3].hex)).toBeGreaterThanOrEqual(4.5);
    assertRealAndDistinct(rows, selected);
  });

  it("admits a light chromatic region, and skips larger neutrals that fail text contrast", () => {
    const light = region("#b4cfee", 0.1);
    const rows = [region("#85232b", 0.3), light,
      region("#5e5e5e", 0.4), region("#303030", 0.02)];
    expect(Math.hypot(light.lab[1], light.lab[2])).toBeGreaterThan(12);
    expect(contrastRatio(rows[2].hex, rows[3].hex)).toBeLessThan(4.5);
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "background")).toBe(light);
    assertRealAndDistinct(rows, selected);
  });

  it("uses the next qualifying region when the largest trim is too close to the subject", () => {
    const facade = region("#d2d0a8", 0.4);
    const closeTrim = region("#e3d8b6", 0.2);
    const distinctTrim = region("#d5cfbe", 0.1);
    const rows = [facade, closeTrim, distinctTrim, region("#050404", 0.01)];
    expect(deltaE76(facade.lab, closeTrim.lab)).toBeLessThan(MIN_ROLE_DELTA_E);
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "primary")).toBe(facade);
    expect(selected.find((s) => s.role === "background")).toBe(distinctTrim);
    assertRealAndDistinct(rows, selected);
  });

  it("can keep a real variant of the same subject to release the largest qualifying cream", () => {
    const facade = region("#d5d2aa", 0.4);
    const facadeVariant = region("#d6d2a6", 0.05);
    const cream = region("#d0c7b2", 0.2);
    const rows = [facade, facadeVariant, cream, region("#eeeeee", 0.08), region("#020505", 0.01)];
    expect(deltaE76(facade.lab, cream.lab)).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(deltaE76(facade.lab, facadeVariant.lab)).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(deltaE76(facadeVariant.lab, cream.lab)).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "primary")).toBe(facadeVariant);
    expect(selected.find((s) => s.role === "background")).toBe(cream);
    expect(facade.role).toBeNull();
    assertRealAndDistinct(rows, selected);
  });

  it("uses a shadow only as a last resort when no distinct non-shadow can fill the slot", () => {
    const shadow = region("#8b8778", 0.15, { spatial: {
      touchesTop: false, borderEdges: 2, upperShare: 0.1, centralShare: 0.2, texture: 1,
    } });
    const cream = region("#d5cfbe", 0.2);
    const text = region("#050404", 0.01);
    const rows = [region("#d2d0a8", 0.3), shadow, cream, text];
    expect(contrastRatio(shadow.hex, text.hex)).toBeGreaterThanOrEqual(4.5);
    expect(isShadowRegion(shadow, [cream])).toBe(true);
    const selected = assignRoles(rows, new Map([[shadow, new Set([cream])]]));
    expect(selected.find((s) => s.role === "background")).toBe(cream);
    expect(selected).toContain(shadow);
    expect(shadow.role).not.toBe("background");
    assertRealAndDistinct(rows, selected);
    const shutters = region("#3c4952", 0.02);
    const withShutters = assignRoles([...rows, shutters], new Map([[shadow, new Set([cream])]]));
    expect(shutters.role).toBe("secondary");
    expect(shadow.role).toBeNull();
    expect(withShutters).not.toContain(shadow);
    assertRealAndDistinct([...rows, shutters], withShutters);
  });

  it("never labels the largest light/neutral region a shadow when it passes text contrast", () => {
    const concrete = region("#bfc0c2", 0.4);
    const lighterGray = region("#eeeeee", 0.1);
    const text = region("#090d11", 0.02);
    const rows = [region("#85232b", 0.3), concrete, lighterGray, text];
    expect(isShadowRegion(concrete, [lighterGray])).toBe(true);
    expect(contrastRatio(concrete.hex, text.hex)).toBeGreaterThanOrEqual(4.5);
    const selected = assignRoles(rows, new Map([[concrete, new Set([lighterGray])]]));
    expect(concrete.role).toBe("background");
    assertRealAndDistinct(rows, selected);
  });

  it("uses shared pixel edges to reject a shadow in actual extraction", async () => {
    const input = await sharp(Buffer.from(`<svg width="384" height="192" xmlns="http://www.w3.org/2000/svg">
      <rect width="360" height="192" fill="#d5cfbe"/>
      <rect width="120" height="180" fill="#8b8778"/>
      <rect x="120" width="180" height="180" fill="#d2d0a8"/>
      <rect x="360" width="24" height="192" fill="#050404"/>
    </svg>`)).png().toBuffer();
    const palette = await extractPalette(input);
    const shadow = palette.regionAtPin(0.1, 0.1)!;
    const facade = palette.regionAtPin(0.5, 0.1)!;
    const cream = palette.regionAtPin(0.1, 0.98)!;
    const text = palette.regionAtPin(1, 1)!;
    expect(shadow.hex).toBe("#8b8778");
    expect(facade.hex).toBe("#d2d0a8");
    expect(cream.hex).toBe("#d5cfbe");
    expect(text.hex).toBe("#050404");
    expect(palette.neighbours.get(shadow)?.has(facade)).toBe(true);
    expect(palette.neighbours.get(facade)?.has(shadow)).toBe(true);
    expect(palette.neighbours.get(shadow)?.has(cream)).toBe(true);
    expect(palette.neighbours.get(shadow)?.has(text)).toBe(false);
    for (const [x, y] of [[-0.1, 0.2], [0.2, 1.1], [NaN, 0.2], [0.2, Infinity]]) {
      expect(palette.regionAtPin(x, y)).toBeUndefined();
    }
    expect(palette.roles.background).toBe("#d5cfbe");
    expect(palette.roles.text).toBe("#050404");
    expect(palette.contrast).toBeGreaterThanOrEqual(4.5);
    expect(palette.swatches.map((s) => s.hex).sort()).toEqual(["#050404", "#8b8778", "#d2d0a8", "#d5cfbe"]);
  });

  it("falls back to the existing real-region ranking when none passes contrast", () => {
    const rows = [region("#777777", 0.3), region("#aaaaaa", 0.2)];
    expect(contrastRatio(rows[0].hex, rows[1].hex)).toBeLessThan(4.5);
    const selected = assignRoles(rows);
    expect(selected.find((s) => s.role === "background")).toBe(rows[1]);
    expect(selected.find((s) => s.role === "text")).toBe(rows[0]);
    assertRealAndDistinct(rows, selected);
  });

  it("keeps a single dark region in background with text and other roles empty", () => {
    const rows = [region("#555555", 1)];
    expect(assignRoles(rows)).toEqual(rows);
    expect(rows[0].role).toBe("background");
  });
});

describe("shadow definition", () => {
  const shadow = region("#8b8778", 0.3);
  const lit = region("#d5cfbe", 0.1);

  it("requires a meaningful adjacent region with substantially higher luminance", () => {
    expect(isShadowRegion(shadow, [])).toBe(false);
    expect(isShadowRegion(shadow, [region(lit.hex, MIN_ROLE_PATCH / 2)])).toBe(false);
    expect(isShadowRegion(shadow, [{ ...lit, lab: [shadow.lab[0] + 9.9, lit.lab[1], lit.lab[2]] }])).toBe(false);
    expect(isShadowRegion(shadow, [{ ...lit, lab: [shadow.lab[0] + 10, lit.lab[1], lit.lab[2]] }])).toBe(true);
    expect(isShadowRegion(shadow, [lit])).toBe(true);
  });

  it("does not mistake an adjacent different hue or highly chromatic material for a shadow", () => {
    expect(isShadowRegion(shadow, [region("#99bbdd", 0.1)])).toBe(false);
    expect(isShadowRegion(region("#85232b", 0.3), [region("#ef9090", 0.1)])).toBe(false);
  });

  it("does not treat concrete gray or slate shutters as shadows of different low-chroma hues", () => {
    expect(isShadowRegion(region("#bfc0c2", 0.12), [region("#e6eff4", 0.02)])).toBe(false);
    expect(isShadowRegion(region("#3c4952", 0.004), [region("#7f8f8b", 0.002)])).toBe(false);
  });

  it("requires chroma similarity in both directions even with matching hue", () => {
    const shade = region("#777777", 0.1, { lab: [50, 0, 10] });
    expect(isShadowRegion(shade, [region("#cccccc", 0.2, { lab: [80, 0, 15] })])).toBe(true);
    expect(isShadowRegion(shade, [region("#cccccc", 0.2, { lab: [80, 0, 15.1] })])).toBe(false);
    expect(isShadowRegion(shade, [region("#cccccc", 0.2, { lab: [80, 0, 4.9] })])).toBe(false);
  });

  it("compares hue across the wrap and treats achromatic neighbours as one neutral family", () => {
    expect(isShadowRegion(region("#999999", 0.3, { lab: [50, 10, -1] }),
      [region("#cccccc", 0.1, { lab: [80, 12, 1] })])).toBe(true);
    expect(isShadowRegion(region("#777777", 0.3), [region("#cccccc", 0.1)])).toBe(true);
  });
});

describe("real region merge and refill", () => {
  it("exposes connected components omitted from the role swatches for suggestion snapping", async () => {
    const input = await sharp(Buffer.from(`<svg width="384" height="192" xmlns="http://www.w3.org/2000/svg">
      <rect width="384" height="192" fill="#d5cfbe"/>
      <rect width="120" height="192" fill="#85232b"/>
      <rect x="264" width="120" height="192" fill="#85232b"/>
    </svg>`)).png().toBuffer();
    const palette = await extractPalette(input);
    const reds = palette.regions.filter((s) => s.hex === "#85232b");
    expect(reds).toHaveLength(2);
    expect(reds[0].pinX).toBeLessThan(reds[1].pinX);
    expect(palette.swatches.filter((s) => s.hex === "#85232b")).toHaveLength(1);
    for (const swatch of palette.swatches) expect(palette.regions).toContain(swatch);
  });

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
