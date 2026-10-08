import "server-only";
import sharp from "sharp";
import { hexToFamily, rgbToHex, type ColorFamily } from "@/lib/colors";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { textOnBackgroundContrast } from "@/lib/contrast";
import { emptyRoles, type RoleColors } from "@/lib/tokens";
import { REGION_ORIGIN } from "@/lib/derived-roles";

export { contrastRatio, textOnBackgroundContrast } from "@/lib/contrast";

export interface PaletteSwatch {
  origin: typeof REGION_ORIGIN;
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

export const PALETTE_THUMB = 384;
const K = 12;
const EDGE = 0.06;
const MIN_SHARE = 0.0003;
const MIN_PATCH = 0.0003;
const MERGE_DE = 7;
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

function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function kmeans(points: Array<[number, number, number]>, k: number, iterations = 25): { assign: Int32Array; centers: Array<[number, number, number]> } {
  const rng = mulberry32(0);
  const n = points.length;
  const centers: Array<[number, number, number]> = [];
  // Farthest-point seeds cover small, distinct colours instead of repeatedly
  // seeding the dominant wall. A solid image gets exactly one cluster.
  centers.push([...points[Math.floor(rng() * n)]!]);
  const distances = new Float64Array(n).fill(Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1]!;
    let farthest = 0;
    for (let i = 0; i < n; i++) {
      distances[i] = Math.min(distances[i]!, deltaE(points[i]!, last));
      if (distances[i]! > distances[farthest]!) farthest = i;
    }
    if (distances[farthest]! < 1) break;
    centers.push([...points[farthest]!]);
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

function connectedRegions(mask: Uint8Array, w: number, h: number): number[][] {
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const regions: number[][] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    seen[start] = 1;
    while (head < tail) {
      const index = queue[head++]!;
      const x = index % w;
      const y = Math.floor(index / w);
      const neighbors = [x > 0 ? index - 1 : -1, x + 1 < w ? index + 1 : -1,
        y > 0 ? index - w : -1, y + 1 < h ? index + w : -1];
      for (const next of neighbors) {
        if (next < 0 || !mask[next] || seen[next]) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail / (w * h) >= MIN_PATCH) regions.push(Array.from(queue.subarray(0, tail)));
  }
  return regions;
}

/** A member pixel well inside the actual component, never a centroid in a hole. */
function regionPin(members: number[], w: number, h: number): number {
  const mask = new Uint8Array(w * h);
  for (const index of members) mask[index] = 1;
  const depth = new Int32Array(w * h).fill(w + h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) depth[i] = 0;
      else depth[i] = Math.min(x > 0 ? depth[i - 1]! + 1 : 1, y > 0 ? depth[i - w]! + 1 : 1);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (mask[i]) depth[i] = Math.min(depth[i]!, x + 1 < w ? depth[i + 1]! + 1 : 1, y + 1 < h ? depth[i + w]! + 1 : 1);
    }
  }
  const cx = members.reduce((sum, i) => sum + i % w, 0) / members.length;
  const cy = members.reduce((sum, i) => sum + Math.floor(i / w), 0) / members.length;
  return members.reduce((best, i) => {
    if (depth[i]! !== depth[best]!) return depth[i]! > depth[best]! ? i : best;
    const distance = (index: number) => Math.hypot(index % w - cx, Math.floor(index / w) - cy);
    return distance(i) < distance(best) ? i : best;
  });
}

function assignRoles(candidates: PaletteSwatch[]): PaletteSwatch[] {
  const selected: PaletteSwatch[] = [];
  const take = (role: ColorRole, ranked: PaletteSwatch[], separation = MERGE_DE) => {
    const swatch = ranked.find((s) => !selected.some((t) => deltaE(s.lab, t.lab) < separation));
    if (!swatch) return;
    swatch.role = role;
    selected.push(swatch);
  };
  const byScore = (rows: PaletteSwatch[]) => rows.slice().sort((a, b) => b.score - a.score);
  // Preserve the field, true dark detail, and light trim before large middle
  // tones can crowd them out. No colour is changed to meet a contrast target.
  const fields = candidates.filter((s) => s.lab[0] >= 50);
  take("background", byScore(fields.length ? fields : candidates));
  take("text", candidates.filter((s) => s.patch >= 0.001).sort((a, b) => a.lab[0] - b.lab[0] || b.score - a.score));
  take("surface", candidates.slice().sort((a, b) => b.lab[0] - a.lab[0]), 3);
  const chromatic = candidates.filter((s) => Math.hypot(s.lab[1], s.lab[2]) >= 12);
  take("primary", byScore(candidates));
  // A chromatic, perceptually separate detail earns accent; gray never does.
  take("accent", byScore(candidates.filter((s) => Math.hypot(s.lab[1], s.lab[2]) >= 25 &&
    selected.every((t) => deltaE(s.lab, t.lab) >= 18))));
  take("secondary", [...byScore(chromatic.filter((s) => s.lab[0] >= 50)), ...byScore(candidates)]);
  return selected;
}

export async function extractPalette(
  input: Buffer,
  auditRegion?: (swatch: PaletteSwatch, pixels: readonly number[], width: number, height: number) => void,
): Promise<ExtractedPalette> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: PALETTE_THUMB, height: PALETTE_THUMB, fit: "inside" })
    .toColourspace("srgb")
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
  // Extremely narrow images may have no interior after the edge crop.
  if (keepIdx.length === 0) for (let i = 0; i < pixels; i++) keepIdx.push(i);
  const keptLabs = keepIdx.map((i) => labs[i]!);
  const { assign, centers } = kmeans(keptLabs, Math.min(K, keptLabs.length));

  const fullAssign = new Int32Array(pixels).fill(-1);
  for (let i = 0; i < keepIdx.length; i++) fullAssign[keepIdx[i]!] = assign[i]!;

  const candidates: PaletteSwatch[] = [];
  const regions = new Map<PaletteSwatch, number[]>();
  // Join neighbouring colour clusters before spatial segmentation, so slight
  // texture/shading does not fragment a continuous wall into tiny pieces.
  const groups: number[][] = [];
  for (let j = 0; j < centers.length; j++) {
    const group = groups.find((g) => deltaE(centers[j]!, centers[g[0]!]!) < MERGE_DE);
    if (group) group.push(j);
    else groups.push([j]);
  }
  for (const group of groups) {
    const mask = new Uint8Array(pixels);
    for (const index of keepIdx) if (group.includes(fullAssign[index]!)) mask[index] = 1;
    const clusterShare = mask.reduce((sum, value) => sum + value, 0) / keepIdx.length;
    for (const region of connectedRegions(mask, w, h)) {
      const area = region.length / keepIdx.length;
      if (area < MIN_SHARE) continue;
      // Resampling can create a one-pixel colour along a hard boundary. A
      // region needs an interior pixel to count as its own material/detail.
      if (!region.some((i) => i % w > 0 && i % w < w - 1 && i >= w && i < pixels - w &&
        mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w])) continue;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (const index of region) {
        sr += rgbs[index]![0];
        sg += rgbs[index]![1];
        sb += rgbs[index]![2];
      }
      const hex = rgbToHex(sr / region.length, sg / region.length, sb / region.length);
      const lab = rgbToLab(sr / region.length, sg / region.length, sb / region.length);
      const chroma = Math.hypot(lab[1], lab[2]);
      let perimeter = 0;
      for (const index of region) {
        const x = index % w;
        const y = Math.floor(index / w);
        if (x === 0 || !mask[index - 1]) perimeter++;
        if (x === w - 1 || !mask[index + 1]) perimeter++;
        if (y === 0 || !mask[index - w]) perimeter++;
        if (y === h - 1 || !mask[index + w]) perimeter++;
      }
      // A long antialiased edge must not outrank a compact tile/detail of the
      // same colour. This still scores only measured, connected photo pixels.
      const compactness = Math.sqrt(4 * Math.PI * region.length / (perimeter * perimeter));
      const family = hexToFamily(hex);
      const swatch: PaletteSwatch = {
        origin: REGION_ORIGIN,
        hex, share: clusterShare, patch: region.length / pixels, pinX: 0, pinY: 0, lab,
        score: area * (1 + chroma / 25) * compactness, family, name: family, role: null,
      };
      candidates.push(swatch);
      regions.set(swatch, region);
    }
  }
  const swatches = assignRoles(candidates).slice(0, MAX_SWATCHES);
  const roles = emptyRoles();
  for (const swatch of swatches) {
    const region = regions.get(swatch)!;
    const pin = regionPin(region, w, h);
    swatch.pinX = (pin % w) / w;
    swatch.pinY = Math.floor(pin / w) / h;
    roles[swatch.role!] = swatch.hex;
    auditRegion?.(swatch, region, w, h);
  }
  return { swatches, roles, contrast: textOnBackgroundContrast(roles) };
}

export async function areaAverage(
  input: Buffer,
  nx: number,
  ny: number,
  radius = 8,
): Promise<{ hex: string; pinX: number; pinY: number }> {
  const { data, info } = await sharp(input).rotate().toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
