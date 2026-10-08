import type { NamedColor } from "@/lib/brief-copy";
import { hexToLab, MIN_ROLE_DELTA_E, roleDeltaE } from "@/lib/color-distance";
import { MIN_ROLE_PATCH, type PaletteSwatch } from "@/lib/palette-extract";

/** Offer only measured regions that are distinct from every filled role. */
export function snapNamedColors(
  named: readonly NamedColor[],
  regions: readonly Pick<PaletteSwatch, "hex" | "lab" | "patch" | "pinX" | "pinY">[],
  filledHexes: Iterable<string>,
): NamedColor[] {
  const candidates = regions.filter((region) => region.patch >= MIN_ROLE_PATCH);
  if (candidates.length === 0) return [];
  const filledLabs = Array.from(filledHexes, hexToLab);
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
    if (seen.has(nearest) || filledLabs.some((filled) => roleDeltaE(nearest.lab, filled) < MIN_ROLE_DELTA_E)) continue;
    seen.add(nearest);
    snapped.push({ ...color, hex: nearest.hex, pinX: nearest.pinX, pinY: nearest.pinY });
  }
  return snapped;
}
