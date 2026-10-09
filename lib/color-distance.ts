import { hexToRgb } from "@/lib/colors";

export type Lab = [number, number, number];

/**
 * Filled extraction roles must be separated by CIE76 ΔE (Euclidean CIELAB) ≥ 12,
 * the metric the r8 audit measured with.
 */
export const MIN_ROLE_DELTA_E = 12;
export const ROLE_DELTA_E_METRIC = "CIE76 (Euclidean CIELAB, sRGB / D65)";

export function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The distinctness metric used for role selection and audits. */
export const roleDeltaE = deltaE76;

export function rgbToLab(r: number, g: number, b: number): Lab {
  const linear = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const rl = linear(r);
  const gl = linear(g);
  const bl = linear(b);
  const x = (0.4124 * rl + 0.3576 * gl + 0.1805 * bl) / 0.9505;
  const y = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  const z = (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) / 1.089;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function hexToLab(hex: string): Lab {
  const { r, g, b } = hexToRgb(hex);
  return rgbToLab(r, g, b);
}
