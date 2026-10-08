import sharp from "sharp";
import { hexToFamily, rgbToHex, type ColorFamily } from "@/lib/colors";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { emptyRoles, type RoleColors } from "@/lib/tokens";

export interface PaletteSwatch {
  hex: string;
  share: number;
  patch: number;
  pinX: number;
  pinY: number;
  lab: [number, number, number];
  score: number;
  family: ColorFamily;
  name: string;
  role: ColorRole | null;
}

export interface ExtractedPalette {
  swatches: PaletteSwatch[];
  roles: RoleColors;
  contrast: number | null;
}

const THUMB = 256;
const K = 12;
const EDGE = 0.06;
const MIN_SHARE = 0.015;
const MIN_PATCH = 0.004;
const MERGE_DE = 10;
const MAX_SWATCHES = 6;
const TARGET_CONTRAST = 4.5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function kmeans(points: Array<[number, number, number]>, k: number, iterations = 25): { assign: Int32Array; centers: Array<[number, number, number]> } {
  const rng = mulberry32(0);
  const n = points.length;
  const centers: Array<[number, number, number]> = [];
  const used = new Set<number>();
  while (centers.length < k && used.size < n) {
    const i = Math.floor(rng() * n);
    if (used.has(i)) continue;
    used.add(i);
    centers.push([...points[i]!]);
  }
  const assign = new Int32Array(n);
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      const p = points[i]!;
      for (let j = 0; j < centers.length; j++) {
        const d = deltaE(p, centers[j]!);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      assign[i] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0] as [number, number, number, number]);
    for (let i = 0; i < n; i++) {
      const j = assign[i]!;
      const p = points[i]!;
      const s = sums[j]!;
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3] += 1;
    }
    for (let j = 0; j < centers.length; j++) {
      const s = sums[j]!;
      if (s[3] > 0) centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    }
  }
  return { assign, centers };
}

function largestBlob(mask: Uint8Array, w: number, h: number): { size: number; cx: number; cy: number } | null {
  const seen = new Uint8Array(w * h);
  let bestSize = 0;
  let bestCx = 0;
  let bestCy = 0;
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!mask[start] || seen[start]) continue;
      let head = 0;
      let tail = 0;
      qx[tail] = x;
      qy[tail] = y;
      tail++;
      seen[start] = 1;
      let size = 0;
      let sumX = 0;
      let sumY = 0;
      let maxDist = -1;
      let interiorX = x;
      let interiorY = y;
      while (head < tail) {
        const cx = qx[head]!;
        const cy = qy[head]!;
        head++;
        size++;
        sumX += cx;
        sumY += cy;
        // 4-connected
        const neighbors = [cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1];
        for (let n = 0; n < 8; n += 2) {
          const nx = neighbors[n]!;
          const ny = neighbors[n + 1]!;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const idx = ny * w + nx;
          if (!mask[idx] || seen[idx]) continue;
          seen[idx] = 1;
          qx[tail] = nx;
          qy[tail] = ny;
          tail++;
        }
        let dist = 0;
        if (cx > 0 && mask[cy * w + (cx - 1)]) dist++;
        if (cx + 1 < w && mask[cy * w + (cx + 1)]) dist++;
        if (cy > 0 && mask[(cy - 1) * w + cx]) dist++;
        if (cy + 1 < h && mask[(cy + 1) * w + cx]) dist++;
        if (dist >= maxDist) {
          maxDist = dist;
          interiorX = cx;
          interiorY = cy;
        }
      }
      if (size > bestSize) {
        bestSize = size;
        const meanX = sumX / size;
        const meanY = sumY / size;
        const meanIdx = Math.round(meanY) * w + Math.round(meanX);
        if (meanIdx >= 0 && meanIdx < mask.length && mask[meanIdx]) {
          bestCx = meanX;
          bestCy = meanY;
        } else {
          bestCx = interiorX;
          bestCy = interiorY;
        }
      }
    }
  }
  if (bestSize === 0) return null;
  return { size: bestSize, cx: bestCx, cy: bestCy };
}

function looksLikeSky(lab: [number, number, number], pinY: number): boolean {
  const chroma = Math.hypot(lab[1], lab[2]);
  return pinY < 0.12 && lab[0] > 60 && chroma < 22;
}

function looksLikeSidewalk(lab: [number, number, number], pinY: number): boolean {
  const chroma = Math.hypot(lab[1], lab[2]);
  return pinY > 0.85 && chroma < 14 && lab[0] > 30 && lab[0] < 78;
}

function assignRoles(swatches: PaletteSwatch[]): RoleColors {
  const roles = emptyRoles();
  if (swatches.length === 0) return roles;
  const bg = swatches.reduce((a, b) => (a.share >= b.share ? a : b));
  bg.role = "background";
  roles.background = bg.hex;
  const others = swatches.filter((s) => s !== bg);
  if (others.length > 0) {
    const text = others.slice().sort((a, b) => a.lab[0] - b.lab[0])[0]!;
    text.role = "text";
    roles.text = text.hex;
  }
  const leftover: ColorRole[] = ["primary", "secondary", "accent", "surface"];
  const rest = swatches.filter((s) => s.role === null).sort((a, b) => b.score - a.score);
  for (const s of rest) {
    const role = leftover.shift();
    if (!role) continue;
    s.role = role;
    roles[role] = s.hex;
  }
  return roles;
}

export async function extractPalette(input: Buffer): Promise<ExtractedPalette> {
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
  const rgbs: Array<[number, number, number]> = new Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const r = data[i * 3]!;
    const g = data[i * 3 + 1]!;
    const b = data[i * 3 + 2]!;
    rgbs[i] = [r, g, b];
    labs[i] = rgbToLab(r, g, b);
  }

  const keepIdx: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > w * EDGE && x < w * (1 - EDGE) && y > h * EDGE && y < h * (1 - EDGE)) {
        keepIdx.push(y * w + x);
      }
    }
  }
  const keptLabs = keepIdx.map((i) => labs[i]!);
  const { assign, centers } = kmeans(keptLabs, Math.min(K, keptLabs.length));

  const fullAssign = new Int32Array(pixels).fill(-1);
  for (let i = 0; i < keepIdx.length; i++) fullAssign[keepIdx[i]!] = assign[i]!;

  const candidates: PaletteSwatch[] = [];
  for (let j = 0; j < centers.length; j++) {
    const members: number[] = [];
    for (let i = 0; i < keepIdx.length; i++) if (assign[i] === j) members.push(keepIdx[i]!);
    const share = members.length / keepIdx.length;
    if (share < MIN_SHARE) continue;

    const mask = new Uint8Array(pixels);
    for (let p = 0; p < pixels; p++) if (fullAssign[p] === j) mask[p] = 1;
    const blob = largestBlob(mask, w, h);
    if (!blob) continue;
    const patch = blob.size / pixels;
    if (patch < MIN_PATCH) continue;

    const pinX = blob.cx / w;
    const pinY = blob.cy / h;
    const C = centers[j]!;
    if (looksLikeSky(C, pinY) || looksLikeSidewalk(C, pinY)) continue;

    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (const idx of members) {
      const rgb = rgbs[idx]!;
      sr += rgb[0];
      sg += rgb[1];
      sb += rgb[2];
    }
    const hex = rgbToHex(sr / members.length, sg / members.length, sb / members.length);
    const chroma = Math.hypot(C[1], C[2]);
    const score = share * (1 + chroma / 25) * (C[0] > 15 && C[0] < 95 ? 1 : 0.5);
    const family = hexToFamily(hex);
    candidates.push({
      hex,
      share,
      patch,
      pinX,
      pinY,
      lab: C,
      score,
      family,
      name: family,
      role: null,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const swatches: PaletteSwatch[] = [];
  for (const s of candidates) {
    if (swatches.some((t) => deltaE(s.lab, t.lab) < MERGE_DE)) continue;
    swatches.push(s);
    if (swatches.length >= MAX_SWATCHES) break;
  }

  if (swatches.length === 0) {
    const stats = await sharp(input).stats();
    const hex = rgbToHex(stats.dominant.r, stats.dominant.g, stats.dominant.b);
    const family = hexToFamily(hex);
    const only: PaletteSwatch = {
      hex,
      share: 1,
      patch: 1,
      pinX: 0.5,
      pinY: 0.5,
      lab: rgbToLab(stats.dominant.r, stats.dominant.g, stats.dominant.b),
      score: 1,
      family,
      name: family,
      role: "background",
    };
    const roles = emptyRoles();
    roles.background = hex;
    return { swatches: [only], roles, contrast: null };
  }

  const roles = assignRoles(swatches);
  const contrast =
    roles.text && roles.background ? contrastRatio(roles.text, roles.background) : null;
  return { swatches, roles, contrast };
}

export function textOnBackgroundContrast(roles: RoleColors): number | null {
  if (!roles.text || !roles.background) return null;
  return contrastRatio(roles.text, roles.background);
}

export async function areaAverage(
  input: Buffer,
  nx: number,
  ny: number,
  radius = 8,
): Promise<{ hex: string; pinX: number; pinY: number }> {
  const { data, info } = await sharp(input).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const cx = Math.max(0, Math.min(w - 1, Math.round(nx * w)));
  const cy = Math.max(0, Math.min(h - 1, Math.round(ny * h)));
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(h - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(w - 1, cx + radius); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > radius * radius) continue;
      const i = (y * w + x) * 3;
      sr += data[i]!;
      sg += data[i + 1]!;
      sb += data[i + 2]!;
      n++;
    }
  }
  if (n === 0) {
    const i = (cy * w + cx) * 3;
    return { hex: rgbToHex(data[i]!, data[i + 1]!, data[i + 2]!), pinX: cx / w, pinY: cy / h };
  }
  return { hex: rgbToHex(sr / n, sg / n, sb / n), pinX: cx / w, pinY: cy / h };
}

export { COLOR_ROLES, TARGET_CONTRAST };
