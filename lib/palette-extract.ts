import "server-only";
import sharp from "sharp";
import { hexToFamily, rgbToHex, type ColorFamily } from "@/lib/colors";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { contrastRatio, textOnBackgroundContrast } from "@/lib/contrast";
import { emptyRoles, type RoleColors } from "@/lib/tokens";
import { REGION_ORIGIN } from "@/lib/derived-roles";
import { hexToLab, MIN_ROLE_DELTA_E, rgbToLab, roleDeltaE } from "@/lib/color-distance";

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
  spatial?: {
    touchesTop: boolean;
    borderEdges: number;
    upperShare: number;
    centralShare: number;
    texture: number;
  };
}

export interface ExtractedPalette {
  swatches: PaletteSwatch[];
  /** All connected region means, including components not selected for roles. */
  regions: PaletteSwatch[];
  /** Components sharing a pixel edge; not merely nearby centroids. */
  neighbours: ReadonlyMap<PaletteSwatch, ReadonlySet<PaletteSwatch>>;
  /** Resolve a normalized pin to the component owning that pixel. */
  regionAtPin: (pinX: number, pinY: number) => PaletteSwatch | undefined;
  roles: RoleColors;
  contrast: number | null;
}

export const PALETTE_THUMB = 384;
const K = 16;
const EDGE = 0.06;
const MIN_SHARE = 0.0003;
const MIN_PATCH = 0.0003;
export const MIN_ROLE_PATCH = 0.001;
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

// Squared Euclidean Lab distance is only the k-means fitting metric. Keep the
// expensive CIEDE2000 calculation out of this per-pixel, iterative hot path.
function labDistanceSquared(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
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
      distances[i] = Math.min(distances[i]!, labDistanceSquared(points[i]!, last));
      if (distances[i]! > distances[farthest]!) farthest = i;
    }
    if (distances[farthest]! < 1) break;
    centers.push([...points[farthest]!]);
  }
  const assign = new Int32Array(n).fill(-1);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      const p = points[i]!;
      for (let j = 0; j < centers.length; j++) {
        const d = labDistanceSquared(p, centers[j]!);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (assign[i] !== best) changed = true;
      assign[i] = best;
    }
    if (!changed) break;
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

export function isSkyLike(swatch: Pick<PaletteSwatch, "lab" | "spatial">): boolean {
  const spatial = swatch.spatial;
  return Boolean(spatial?.touchesTop && spatial.upperShare >= 0.6 && spatial.texture < 6 &&
    (swatch.lab[2] < -12 || (swatch.lab[0] > 85 && Math.hypot(swatch.lab[1], swatch.lab[2]) < 12)));
}

/**
 * A shadow has low chroma (C* < 25), is at least 10 L* below a meaningful
 * side-adjacent region, with an absolute chroma difference of at most 5 C*.
 * Their Lab hue angles must be within 30° (including wrap), or both C* < 3
 * (the neutral family). L* is the perceptual transform of relative luminance.
 * Adjacency comes from shared pixel edges, never centroid proximity.
 */
export function isShadowRegion(swatch: PaletteSwatch, neighbours: Iterable<PaletteSwatch>): boolean {
  const chroma = Math.hypot(swatch.lab[1], swatch.lab[2]);
  if (chroma >= 25) return false;
  for (const neighbour of neighbours) {
    const litChroma = Math.hypot(neighbour.lab[1], neighbour.lab[2]);
    if (neighbour.patch < MIN_ROLE_PATCH || neighbour.lab[0] - swatch.lab[0] < 10 || Math.abs(chroma - litChroma) > 5) continue;
    const sameHue = (chroma < 3 && litChroma < 3) ||
      (chroma >= 3 && litChroma >= 3 &&
        (swatch.lab[1] * neighbour.lab[1] + swatch.lab[2] * neighbour.lab[2]) >=
          chroma * litChroma * Math.cos(Math.PI / 6));
    if (sameHue) return true;
  }
  return false;
}

/** Merge near-duplicate choices by role rank; refill only from real components. */
export function assignRoles(
  regions: PaletteSwatch[],
  neighbours: ReadonlyMap<PaletteSwatch, ReadonlySet<PaletteSwatch>> = new Map(),
): PaletteSwatch[] {
  for (const region of regions) region.role = null;
  const candidates = regions.filter((s) => s.patch >= MIN_ROLE_PATCH);
  const suitableText = candidates.filter((s) => s.lab[0] < 60 && Math.hypot(s.lab[1], s.lab[2]) < 25)
    .sort((a, b) => a.lab[0] - b.lab[0] || b.patch - a.patch);
  const lightOrNeutral = (s: PaletteSwatch) => s.lab[0] >= 60 || Math.hypot(s.lab[1], s.lab[2]) < 12;
  // Find the largest light/neutral before the contrast gate: a dominant dark
  // shadow must not transfer this exemption to a smaller shaded component.
  const largestField = candidates.filter(lightOrNeutral).sort((a, b) => b.patch - a.patch)[0];
  const shadows = new Set(candidates.filter((s) =>
    !(s === largestField && suitableText[0] && contrastRatio(s.hex, suitableText[0].hex) >= TARGET_CONTRAST) &&
    isShadowRegion(s, neighbours.get(s) ?? [])));
  const selected: PaletteSwatch[] = [];
  const take = (role: ColorRole, ranked: PaletteSwatch[]) => {
    const distinct = (s: PaletteSwatch) => !selected.some((t) => roleDeltaE(s.lab, t.lab) < MIN_ROLE_DELTA_E);
    const available = ranked.filter(distinct);
    const nonShadows = available.filter((s) => !shadows.has(s));
    // Shadows may fill any role only after its distinct non-shadow choices
    // are exhausted. Apply the same preference to near-duplicate merging.
    const choices = nonShadows.length ? nonShadows : available;
    let swatch = choices[0];
    if (!swatch) return;
    if (role === "primary" || role === "background") {
      // Keep the larger connected component of a near-duplicate family, while
      // retaining the chosen subject/backdrop class. Do not average regions.
      const preferred = swatch;
      swatch = choices.filter((s) => isSkyLike(s) === isSkyLike(preferred) &&
        ((s.spatial?.borderEdges ?? 0) >= 2) === ((preferred.spatial?.borderEdges ?? 0) >= 2) &&
        roleDeltaE(s.lab, preferred.lab) < MIN_ROLE_DELTA_E)
        .sort((a, b) => b.patch - a.patch || b.score - a.score)[0]!;
    }
    swatch.role = role;
    selected.push(swatch);
  };
  const byScore = (rows: PaletteSwatch[]) => rows.slice().sort((a, b) => b.score - a.score || b.patch - a.patch);
  const chromatic = candidates.filter((s) => Math.hypot(s.lab[1], s.lab[2]) >= 12);
  const primaryScore = (s: PaletteSwatch) => s.score * (0.5 + (s.spatial?.centralShare ?? 0.5)) *
    (isSkyLike(s) ? 0.08 : 1) * ((s.spatial?.borderEdges ?? 0) >= 2 ? 0.35 : 1);
  let primaryCandidates: PaletteSwatch[] = [];
  // Reserve the dominant subject before field/trim assignment can take it.
  // A neutral-only image still follows the existing background/text semantics.
  if (chromatic.length) {
    take("text", suitableText);
    const nonSky = candidates.filter((s) => !isSkyLike(s));
    const foreground = nonSky.filter((s) =>
      ((s.spatial?.borderEdges ?? 0) < 2 || (s.spatial?.centralShare ?? 0.5) >= 0.5));
    const subjects = foreground.filter((s) => Math.hypot(s.lab[1], s.lab[2]) >= 12 &&
      selected.every((t) => roleDeltaE(s.lab, t.lab) >= MIN_ROLE_DELTA_E));
    primaryCandidates = (subjects.length ? subjects : foreground.length ? foreground : nonSky).slice()
      .sort((a, b) => primaryScore(b) - primaryScore(a) || b.patch - a.patch);
    take("primary", primaryCandidates);
  }
  const calm = candidates.filter((s) => Math.hypot(s.lab[1], s.lab[2]) < 12);
  const fields = chromatic.length ? calm : calm.filter((s) => s.lab[0] >= 60);
  const text = selected.find((s) => s.role === "text") ?? suitableText[0];
  const primary = selected.find((s) => s.role === "primary");
  // Reserve the subject, then prefer the largest eligible L* >= 75 region.
  // Fall back to the largest light/neutral region if no brighter one clears
  // the gates, including subject replacement. Check rounded hex Lab.
  const backgrounds = text ? candidates.filter((s) =>
    lightOrNeutral(s) &&
    contrastRatio(s.hex, text.hex) >= TARGET_CONTRAST &&
    !shadows.has(s) &&
    selected.every((t) => t === primary || roleDeltaE(s.lab, t.lab) >= MIN_ROLE_DELTA_E))
    .sort((a, b) => Number(b.lab[0] >= 75) - Number(a.lab[0] >= 75) ||
      b.patch - a.patch || b.score - a.score) : [];
  let background: PaletteSwatch | undefined;
  for (const candidate of backgrounds) {
    if (!primary || roleDeltaE(candidate.lab, primary.lab) >= MIN_ROLE_DELTA_E) {
      background = candidate;
      break;
    }
    // A real variant of the same reserved subject can release larger lit trim.
    // Keep its subject/backdrop class; never tint either hex to clear the gate.
    const replacement = primaryCandidates.filter((s) =>
      !shadows.has(s) &&
      isSkyLike(s) === isSkyLike(primary) &&
      ((s.spatial?.borderEdges ?? 0) >= 2) === ((primary.spatial?.borderEdges ?? 0) >= 2) &&
      roleDeltaE(s.lab, primary.lab) < MIN_ROLE_DELTA_E &&
      roleDeltaE(s.lab, candidate.lab) >= MIN_ROLE_DELTA_E &&
      selected.every((t) => t === primary || roleDeltaE(s.lab, t.lab) >= MIN_ROLE_DELTA_E))
      .sort((a, b) => b.patch - a.patch || primaryScore(b) - primaryScore(a))[0];
    if (replacement) {
      primary.role = null;
      replacement.role = "primary";
      selected[selected.indexOf(primary)] = replacement;
      background = candidate;
      break;
    }
  }
  take("background", background ? [background] : byScore(fields.length ? fields : calm.length ? calm : candidates));
  if (!selected.some((s) => s.role === "text")) take("text", candidates.filter((s) => s.lab[0] < 60)
    .sort((a, b) => a.lab[0] - b.lab[0] || b.patch - a.patch));
  take("surface", candidates.filter((s) => s.lab[0] >= 70)
    .sort((a, b) => Number((a.spatial?.borderEdges ?? 0) > 0) - Number((b.spatial?.borderEdges ?? 0) > 0) ||
      b.lab[0] - a.lab[0] || b.patch - a.patch));
  // A chromatic, perceptually separate detail earns accent; gray never does.
  take("accent", byScore(candidates.filter((s) => Math.hypot(s.lab[1], s.lab[2]) >= 25)));
  take("secondary", candidates.slice().sort((a, b) => primaryScore(b) - primaryScore(a) || b.patch - a.patch));
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
  // Fit on the cropped interior, but segment the whole image. Otherwise no
  // region can touch the actual top/border and sky detection is impossible.
  for (let i = 0; i < pixels; i++) {
    if (fullAssign[i] !== -1) continue;
    let best = 0;
    for (let j = 1; j < centers.length; j++) {
      if (labDistanceSquared(labs[i]!, centers[j]!) < labDistanceSquared(labs[i]!, centers[best]!)) best = j;
    }
    fullAssign[i] = best;
  }

  const candidates: PaletteSwatch[] = [];
  const regions = new Map<PaletteSwatch, number[]>();
  // Join neighbouring colour clusters before spatial segmentation, so slight
  // texture/shading does not fragment a continuous wall into tiny pieces.
  const groups: number[][] = [];
  for (let j = 0; j < centers.length; j++) {
    const group = groups.find((g) => labDistanceSquared(centers[j]!, centers[g[0]!]!) < MERGE_DE ** 2);
    if (group) group.push(j);
    else groups.push([j]);
  }
  for (const group of groups) {
    const mask = new Uint8Array(pixels);
    for (let index = 0; index < pixels; index++) if (group.includes(fullAssign[index]!)) mask[index] = 1;
    const clusterShare = mask.reduce((sum, value) => sum + value, 0) / pixels;
    for (const region of connectedRegions(mask, w, h)) {
      const area = region.length / pixels;
      if (area < MIN_SHARE) continue;
      // Resampling can create a one-pixel colour along a hard boundary. A
      // region needs an interior pixel to count as its own material/detail.
      if (!region.some((i) => i % w > 0 && i % w < w - 1 && i >= w && i < pixels - w &&
        mask[i - 1] && mask[i + 1] && mask[i - w] && mask[i + w])) continue;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sx = 0;
      let sy = 0;
      let upper = 0;
      let central = 0;
      let texture = 0;
      let textureEdges = 0;
      const borders = new Set<string>();
      for (const index of region) {
        sr += rgbs[index]![0];
        sg += rgbs[index]![1];
        sb += rgbs[index]![2];
        const x = index % w;
        const y = Math.floor(index / w);
        sx += x;
        sy += y;
        if (y < h * 0.35) upper++;
        if (x > w * 0.2 && x < w * 0.8 && y > h * 0.2 && y < h * 0.8) central++;
        if (y === 0) borders.add("top");
        if (y === h - 1) borders.add("bottom");
        if (x === 0) borders.add("left");
        if (x === w - 1) borders.add("right");
        for (const next of [x + 1 < w ? index + 1 : -1, y + 1 < h ? index + w : -1]) {
          if (next >= 0 && mask[next]) {
            texture += Math.sqrt(labDistanceSquared(labs[index]!, labs[next]!));
            textureEdges++;
          }
        }
      }
      const hex = rgbToHex(sr / region.length, sg / region.length, sb / region.length);
      // Separation is checked on the exact rounded hex the user receives.
      const lab = hexToLab(hex);
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
        hex, share: clusterShare, patch: area, pinX: sx / region.length / w, pinY: sy / region.length / h, lab,
        score: area * (1 + chroma / 25) * compactness, family, name: family, role: null,
        spatial: { touchesTop: borders.has("top"), borderEdges: borders.size,
          upperShare: upper / region.length, centralShare: central / region.length,
          texture: textureEdges ? texture / textureEdges : 0 },
      };
      candidates.push(swatch);
      regions.set(swatch, region);
    }
  }
  // Track side-adjacent real components so a passing but shaded region cannot
  // become background merely because it is large or neutral.
  const owners = new Int32Array(pixels).fill(-1);
  candidates.forEach((swatch, i) => {
    for (const pixel of regions.get(swatch)!) owners[pixel] = i;
  });
  const neighbours = new Map(candidates.map((s) => [s, new Set<PaletteSwatch>()]));
  for (let i = 0; i < pixels; i++) {
    if (owners[i]! < 0) continue;
    for (const next of [i % w + 1 < w ? i + 1 : -1, i + w < pixels ? i + w : -1]) {
      if (next < 0 || owners[next]! < 0 || owners[i] === owners[next]) continue;
      const a = candidates[owners[i]!]!;
      const b = candidates[owners[next]!]!;
      neighbours.get(a)!.add(b);
      neighbours.get(b)!.add(a);
    }
  }
  const swatches = assignRoles(candidates, neighbours).slice(0, MAX_SWATCHES);
  const roles = emptyRoles();
  for (const swatch of swatches) {
    const region = regions.get(swatch)!;
    roles[swatch.role!] = swatch.hex;
    auditRegion?.(swatch, region, w, h);
  }
  return { swatches, regions: candidates, neighbours,
    regionAtPin: (pinX, pinY) => {
      if (!Number.isFinite(pinX) || !Number.isFinite(pinY) || pinX < 0 || pinX > 1 || pinY < 0 || pinY > 1) return undefined;
      const pixel = Math.min(h - 1, Math.floor(pinY * h)) * w + Math.min(w - 1, Math.floor(pinX * w));
      return candidates[owners[pixel]!];
    },
    roles, contrast: textOnBackgroundContrast(roles) };
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
