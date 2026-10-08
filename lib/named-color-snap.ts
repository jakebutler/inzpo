import type { NamedColor } from "@/lib/brief-copy";
import { hexToLab, MIN_ROLE_DELTA_E, roleDeltaE } from "@/lib/color-distance";
import { isSkyLike, MIN_ROLE_PATCH, type PaletteSwatch } from "@/lib/palette-extract";

type Region = Pick<PaletteSwatch, "hex" | "lab" | "patch" | "pinX" | "pinY" | "spatial">;
type FilledColor = { hex: string; pinX?: number | null; pinY?: number | null };

function sameSurface(a: Region, b: Region): boolean {
  if (isSkyLike(a) && isSkyLike(b)) return true;
  const ca = Math.hypot(a.lab[1], a.lab[2]);
  const cb = Math.hypot(b.lab[1], b.lab[2]);
  if (ca < 3 || cb < 3) return ca < 3 && cb < 3;
  const gap = Math.abs(Math.atan2(a.lab[2], a.lab[1]) - Math.atan2(b.lab[2], b.lab[1])) * 180 / Math.PI;
  return Math.min(gap, 360 - gap) <= 30;
}

/** Offer only measured regions that are distinct from every filled role. */
export function snapNamedColors(
  named: readonly NamedColor[],
  regions: readonly Region[],
  filledHexes: Iterable<string | FilledColor>,
  sources: {
    neighbours?: ReadonlyMap<Region, ReadonlySet<Region>>;
    regionAtPin?: (pinX: number, pinY: number) => Region | undefined;
  } = {},
): NamedColor[] {
  const candidates = regions.filter((region) => region.patch >= MIN_ROLE_PATCH);
  if (candidates.length === 0) return [];
  const filled = Array.from(filledHexes, (color) => typeof color === "string" ? { hex: color } : color);
  const filledLabs = filled.map((color) => hexToLab(color.hex));
  const roleRegions = filled.map((color) =>
    regions.find((region) => region.hex.toLowerCase() === color.hex.toLowerCase()) ??
    (color.pinX != null && color.pinY != null ? sources.regionAtPin?.(color.pinX, color.pinY) : undefined));
  const seen = new Set<(typeof candidates)[number]>();
  const snapped: NamedColor[] = [];
  for (const color of named) {
    const lab = hexToLab(color.hex);
    let nearest = candidates[0]!;
    let distance = roleDeltaE(lab, nearest.lab);
    for (const region of candidates.slice(1)) {
      const nextDistance = roleDeltaE(lab, region.lab);
      if (nextDistance < distance) {
        nearest = region;
        distance = nextDistance;
      }
    }
    if (roleRegions.some((region) => region && (region === nearest ||
      (sources.neighbours?.get(region)?.has(nearest) && sameSurface(region, nearest))))) continue;
    if (seen.has(nearest) || filledLabs.some((filled) => roleDeltaE(nearest.lab, filled) < MIN_ROLE_DELTA_E)) continue;
    seen.add(nearest);
    snapped.push({ ...color, hex: nearest.hex, source: "region", pinX: nearest.pinX, pinY: nearest.pinY });
  }
  return snapped;
}

/**
 * Client-side guard for chips after the kit changes (e.g. a pin dragged onto
 * the suggested surface): hide a measured chip that is now within CIE76 ΔE 12
 * of any filled role. Same-source hiding needs the region map and runs at snap time.
 */
export function chipsDistinctFromRoles(chips: readonly NamedColor[], filledHexes: Iterable<string>): NamedColor[] {
  const filled = Array.from(filledHexes, (hex) => hexToLab(hex));
  return chips.filter((chip) => filled.every((lab) => roleDeltaE(hexToLab(chip.hex), lab) >= MIN_ROLE_DELTA_E));
}
