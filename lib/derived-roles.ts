import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { hexToHsl } from "@/lib/colors";

export const PIN_NEAR = 0.08;
export const HUE_RELATED_DEG = 30;
export const LIGHT_TINT_MIN = 0.07;

export const SAMPLED_ORIGIN = "sampled";
/** A user-requested text contrast correction, with a pin only for a real sample. */
export const FIX_ORIGIN = "fix";
/** Connected-region means from the real-only extractor, with measured pins. */
export const REGION_ORIGIN = "region";

export type ColorWithRole = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  derivedFrom?: ColorRole | null;
  origin?: string | null;
};

const KEEP_ORDER: ColorRole[] = ["background", "text", "primary", "secondary", "accent", "surface"];

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** True when `a` is a lighter or darker take on `b` (or vice versa), not a distinct sample. */
export function isTintOrShade(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const ha = hexToHsl(a);
  const hb = hexToHsl(b);
  const bothGray = ha.s < 0.16 && hb.s < 0.16;
  const hueOk = bothGray || hueDelta(ha.h, hb.h) <= HUE_RELATED_DEG;
  if (!hueOk) return false;
  return Math.abs(ha.l - hb.l) >= LIGHT_TINT_MIN;
}

function pinDistance(
  a: { pinX?: number | null; pinY?: number | null },
  b: { pinX?: number | null; pinY?: number | null },
): number {
  if (a.pinX == null || a.pinY == null || b.pinX == null || b.pinY == null) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.pinX - b.pinX, a.pinY - b.pinY);
}

function fallbackCenter(pinX?: number | null, pinY?: number | null): boolean {
  return pinX === 0.5 && pinY === 0.5;
}

/**
 * Detect padding in legacy rows without changing storage. New region samples
 * and user-set colours are authoritative, even when their hues are related.
 */
export function markDerivedRoles<T extends ColorWithRole>(colors: T[]): Array<T & { derivedFrom: ColorRole | null }> {
  if (!Array.isArray(colors)) return [];
  const filled = colors.filter((c): c is T & { role: ColorRole } => Boolean(c.role) && COLOR_ROLES.includes(c.role!));
  const pending = filled
    .slice()
    .sort((a, b) => KEEP_ORDER.indexOf(a.role) - KEEP_ORDER.indexOf(b.role));
  const sampled: Array<T & { role: ColorRole }> = [];
  const derived = new Map<ColorRole, ColorRole>();

  for (const row of pending) {
    if (row.origin === SAMPLED_ORIGIN || row.origin === FIX_ORIGIN || (row.origin === REGION_ORIGIN && row.pinX != null && row.pinY != null)) {
      sampled.push(row);
      continue;
    }
    if (row.derivedFrom) {
      derived.set(row.role, row.derivedFrom);
      continue;
    }
    // Plain role/hex maps carry no legacy provenance to inspect.
    if (!("origin" in row || "pinX" in row || "pinY" in row)) {
      sampled.push(row);
      continue;
    }
    if (fallbackCenter(row.pinX, row.pinY)) {
      derived.set(row.role, sampled[0]?.role ?? row.role);
      continue;
    }
    const near = sampled.find((s) => pinDistance(row, s) < PIN_NEAR);
    if (near) {
      derived.set(row.role, near.role);
      continue;
    }
    const tintOf = sampled.find((s) => isTintOrShade(row.hex, s.hex));
    if (tintOf) {
      derived.set(row.role, tintOf.role);
      continue;
    }
    sampled.push(row);
  }

  return colors.map((c) => ({
    ...c,
    derivedFrom: c.role ? derived.get(c.role) ?? null : null,
  }));
}

/** Display-time only: generated legacy rows leave their role slot empty. */
export function sampledColors<T extends ColorWithRole>(colors: readonly T[]): T[] {
  return markDerivedRoles([...colors]).filter((c) => c.derivedFrom == null);
}
