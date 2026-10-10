import { describe, expect, it } from "vitest";
import { deltaE76, deltaE2000, hexToLab, MIN_ROLE_DELTA_E, pairwiseRoleDeltaE, roleDeltaE, ROLE_DELTA_E_METRIC, type Lab } from "@/lib/color-distance";

describe("CIEDE2000 (kL = kC = kH = 1)", () => {
  // Sharma/Wu/Dalal reference pairs exercise the blue rotation term, zero
  // chroma and the 180-degree hue discontinuity, not just our own hex output.
  it.each<[Lab, Lab, number]>([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
    [[50, -0.001, 2.49], [50, 0.0011, -2.49], 4.7461],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
  ])("matches published Lab reference pair %#", (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 4);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 4);
    expect(deltaE2000(a, a)).toBe(0);
  });

  it("converts sRGB hexes using a D65 reference white", () => {
    expect(hexToLab("#000000")).toEqual([0, 0, 0]);
    expect(hexToLab("#ffffff")[0]).toBeCloseTo(100, 2);
    expect(hexToLab("#fff")).toEqual(hexToLab("#ffffff"));
  });

});

describe("CIE76 role distinctness", () => {
  it("uses Euclidean Lab distance for role selection", () => {
    const a: Lab = [50, 0, 0];
    const b: Lab = [53, 4, 12];
    expect(deltaE76(a, b)).toBe(13);
    expect(deltaE76(b, a)).toBe(13);
    expect(deltaE76(a, a)).toBe(0);
    expect(roleDeltaE).toBe(deltaE76);
    expect(ROLE_DELTA_E_METRIC).toBe("CIE76 (Euclidean CIELAB, sRGB / D65)");
    expect(MIN_ROLE_DELTA_E).toBe(12);
  });

  it("reports each filled pair once in CIE76, with informational CIEDE2000 and no empty slots", () => {
    const roles = { primary: "#a0adbb", secondary: "#8cadc3", background: "#79acd3", surface: null };
    const pairs = pairwiseRoleDeltaE(roles);
    expect(pairs).toHaveLength(3);
    expect(pairs.map((p) => [p.roleA, p.roleB])).toEqual([
      ["primary", "secondary"], ["primary", "background"], ["secondary", "background"],
    ]);
    for (const pair of pairs) {
      const a = hexToLab(pair.hexA);
      const b = hexToLab(pair.hexB);
      expect(pair.deltaE).toBe(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      expect(pair.deltaE2000).toBe(deltaE2000(a, b));
    }
    expect(pairs[1].deltaE).toBeGreaterThanOrEqual(MIN_ROLE_DELTA_E);
    expect(pairs[1].deltaE2000).toBeLessThan(MIN_ROLE_DELTA_E);
    expect(pairwiseRoleDeltaE({ primary: "#ffffff", text: null })).toEqual([]);
    expect(pairwiseRoleDeltaE({ primary: null, text: null })).toEqual([]);
  });
});
