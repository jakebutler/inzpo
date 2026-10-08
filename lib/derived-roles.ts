import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { hexToHsl } from "@/lib/colors";

export const AUTO_TAG = "auto";
export const PIN_NEAR = 0.08;
export const HUE_RELATED_DEG = 30;
export const LIGHT_TINT_MIN = 0.07;

export type ColorWithRole = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  derivedFrom?: ColorRole | null;
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
 * Sampled roles keep pins and hairlines. Derived roles (tints, shared blobs,
 * leftover center pins) get an "auto" tag and no pin.
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
    if (fallbackCenter(row.pinX, row.pinY) && sampled.length > 0) {
      derived.set(row.role, sampled[0]!.role);
      continue;
    }
    sampled.push(row);
  }

  return colors.map((c) => ({
    ...c,
    derivedFrom: c.role ? derived.get(c.role) ?? null : null,
  }));
}

export function sampledColors<T extends { derivedFrom?: ColorRole | null }>(colors: T[]): T[] {
  return colors.filter((c) => c.derivedFrom == null);
}
