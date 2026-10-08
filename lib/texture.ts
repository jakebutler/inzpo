import sharp from "sharp";

export interface TextureCrop {
  /** Left of the square crop, 0–1 of image width. */
  x: number;
  /** Top of the square crop, 0–1 of image height. */
  y: number;
  /** Side length, 0–1 of the shorter image edge, mapped to both axes. */
  size: number;
  /** True when the crop is a single flat color — hide the texture card. */
  flat: boolean;
}

const THUMB = 256;
const EDGE = 0.08;
const CROP = 0.32;
const FLAT_STD = 5.5;

function srgbToLin(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLin(r);
  const gl = srgbToLin(g);
  const bl = srgbToLin(b);
  const x = (0.4124 * rl + 0.3576 * gl + 0.1805 * bl) / 0.9505;
  const y = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  const z = (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) / 1.089;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function looksLikeSky(lab: [number, number, number], pinY: number): boolean {
  const chroma = Math.hypot(lab[1], lab[2]);
  return pinY < 0.18 && lab[0] > 60 && chroma < 22;
}

/**
 * Default texture crop aims at the subject (chroma, not the most common color).
 * A single-flat-color crop is marked flat so the texture card can hide.
 */
export async function chooseTextureCrop(input: Buffer): Promise<TextureCrop> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: THUMB, height: THUMB, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const pixels = w * h;
  const labs: Array<[number, number, number]> = new Array(pixels);
  for (let i = 0; i < pixels; i++) {
    labs[i] = rgbToLab(data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!);
  }

  let meanL = 0;
  let meanA = 0;
  let meanB = 0;
  let interior = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x <= w * EDGE || x >= w * (1 - EDGE) || y <= h * EDGE || y >= h * (1 - EDGE)) continue;
      const lab = labs[y * w + x]!;
      meanL += lab[0];
      meanA += lab[1];
      meanB += lab[2];
      interior++;
    }
  }
  if (interior === 0) {
    return { x: 0.34, y: 0.34, size: CROP, flat: true };
  }
  meanL /= interior;
  meanA /= interior;
  meanB /= interior;

  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pinY = y / h;
      const lab = labs[y * w + x]!;
      if (looksLikeSky(lab, pinY)) continue;
      if (x <= w * EDGE || x >= w * (1 - EDGE) || y <= h * EDGE || y >= h * (1 - EDGE)) continue;
      const chroma = Math.hypot(lab[1], lab[2]);
      const dMean = Math.hypot(lab[0] - meanL, lab[1] - meanA, lab[2] - meanB);
      const weight = chroma * (0.2 + dMean / 40);
      if (weight <= 0) continue;
      sumW += weight;
      sumX += weight * x;
      sumY += weight * y;
    }
  }

  const cx = sumW > 0 ? sumX / sumW : w / 2;
  const cy = sumW > 0 ? sumY / sumW : h / 2;
  const side = Math.max(8, Math.round(Math.min(w, h) * CROP));
  let left = Math.round(cx - side / 2);
  let top = Math.round(cy - side / 2);
  left = Math.max(0, Math.min(w - side, left));
  top = Math.max(0, Math.min(h - side, top));

  let n = 0;
  let sL = 0;
  let sA = 0;
  let sB = 0;
  let sL2 = 0;
  let sA2 = 0;
  let sB2 = 0;
  for (let y = top; y < top + side; y++) {
    for (let x = left; x < left + side; x++) {
      const lab = labs[y * w + x]!;
      sL += lab[0];
      sA += lab[1];
      sB += lab[2];
      sL2 += lab[0] * lab[0];
      sA2 += lab[1] * lab[1];
      sB2 += lab[2] * lab[2];
      n++;
    }
  }
  const varL = Math.max(0, sL2 / n - (sL / n) ** 2);
  const varA = Math.max(0, sA2 / n - (sA / n) ** 2);
  const varB = Math.max(0, sB2 / n - (sB / n) ** 2);
  const std = n ? Math.sqrt((varL + varA + varB) / 3) : 0;

  return {
    x: left / w,
    y: top / h,
    size: side / Math.min(w, h),
    flat: std < FLAT_STD,
  };
}
