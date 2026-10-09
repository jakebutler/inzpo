import { hexToRgb } from "@/lib/colors";

export type Lab = [number, number, number];

/**
 * Filled extraction roles must be separated by CIE76 ΔE (Euclidean CIELAB) ≥ 12,
 * the metric the r8 audit measured with. CIEDE2000 is reported alongside it.
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

/** CIEDE2000, including hue wrap and the blue-region rotation term. */
export function deltaE2000(a: Lab, b: Lab): number {
  const radians = Math.PI / 180;
  const c1 = Math.hypot(a[1], a[2]);
  const c2 = Math.hypot(b[1], b[2]);
  const cMean7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cMean7 / (cMean7 + 25 ** 7)));
  const ap1 = (1 + g) * a[1];
  const ap2 = (1 + g) * b[1];
  const cp1 = Math.hypot(ap1, a[2]);
  const cp2 = Math.hypot(ap2, b[2]);
  const hue = (x: number, y: number) => (Math.atan2(y, x) / radians + 360) % 360;
  const hp1 = cp1 === 0 ? 0 : hue(ap1, a[2]);
  const hp2 = cp2 === 0 ? 0 : hue(ap2, b[2]);
  const dl = b[0] - a[0];
  const dc = cp2 - cp1;
  let dh = hp2 - hp1;
  if (cp1 * cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(dh * radians / 2);
  const lMean = (a[0] + b[0]) / 2;
  const cMean = (cp1 + cp2) / 2;
  let hMean = (hp1 + hp2) / 2;
  if (cp1 * cp2 === 0) hMean = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) > 180) hMean += hp1 + hp2 < 360 ? 180 : -180;
  const t = 1 - 0.17 * Math.cos((hMean - 30) * radians)
    + 0.24 * Math.cos(2 * hMean * radians)
    + 0.32 * Math.cos((3 * hMean + 6) * radians)
    - 0.20 * Math.cos((4 * hMean - 63) * radians);
  const sl = 1 + 0.015 * (lMean - 50) ** 2 / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cMean;
  const sh = 1 + 0.015 * cMean * t;
  const rt = -2 * Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7))
    * Math.sin(60 * Math.exp(-(((hMean - 275) / 25) ** 2)) * radians);
  const l = dl / sl;
  const c = dc / sc;
  const h = dH / sh;
  return Math.sqrt(l * l + c * c + h * h + rt * c * h);
}

export function pairwiseRoleDeltaE(roles: Record<string, string | null>) {
  const filled = Object.entries(roles).filter((entry): entry is [string, string] => entry[1] != null);
  return filled.flatMap(([roleA, hexA], i) => filled.slice(i + 1).map(([roleB, hexB]) => ({
    roleA, roleB, hexA, hexB,
    deltaE: roleDeltaE(hexToLab(hexA), hexToLab(hexB)),
    deltaE2000: deltaE2000(hexToLab(hexA), hexToLab(hexB)),
  })));
}
