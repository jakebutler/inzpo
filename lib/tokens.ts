import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { isHexColor, normalizeHex } from "@/lib/colors";
import { sampledColors, type ColorWithRole } from "@/lib/derived-roles";

export type RoleColors = Record<ColorRole, string | null>;

export interface DesignTokenColor {
  $value: string;
  $type: "color";
  sampled: true;
}

export function emptyRoles(): RoleColors {
  return {
    primary: null,
    secondary: null,
    accent: null,
    background: null,
    surface: null,
    text: null,
  };
}

export function rolesFromColors(
  rows: ReadonlyArray<ColorWithRole>,
): RoleColors {
  const colors = sampledColors(rows);
  const roles = emptyRoles();
  const used = new Set<number>();
  for (const role of COLOR_ROLES) {
    const index = colors.findIndex((color, i) => color.role === role && !used.has(i));
    if (index < 0) continue;
    const hex = colors[index]!.hex;
    if (!isHexColor(hex)) continue;
    roles[role] = normalizeHex(hex);
    used.add(index);
  }
  return roles;
}

export function filledRoles(roles: RoleColors): ColorRole[] {
  return COLOR_ROLES.filter((role) => roles[role] !== null);
}

/** Pin badges follow filled roles in position order, matching the 3×2 grid. */
export function pinNumbers(
  colors: ReadonlyArray<{ role?: ColorRole | null; position?: number }>,
): Partial<Record<ColorRole, number>> {
  const pins: Partial<Record<ColorRole, number>> = {};
  const ordered = [...colors].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  let n = 1;
  for (const color of ordered) {
    if (!color.role) continue;
    pins[color.role] = n;
    n += 1;
  }
  return pins;
}

/** Editing one role never pads the others. */
export function setRoleColor(roles: RoleColors, role: ColorRole, hex: string | null): RoleColors {
  const next = { ...roles };
  if (hex === null) {
    next[role] = null;
    return next;
  }
  if (!isHexColor(hex)) return next;
  const value = normalizeHex(hex);
  for (const other of COLOR_ROLES) {
    if (other !== role && next[other] === value) next[other] = null;
  }
  next[role] = value;
  return next;
}

export function moveRole(roles: RoleColors, from: ColorRole, to: ColorRole): RoleColors {
  if (from === to) return roles;
  const next = { ...roles };
  const value = next[from];
  next[from] = next[to];
  next[to] = value;
  return next;
}

export function designTokenColors(roles: RoleColors): Partial<Record<ColorRole, DesignTokenColor>> | null {
  if (filledRoles(roles).length === 0) return null;
  const out: Partial<Record<ColorRole, DesignTokenColor>> = {};
  for (let i = 0; i < COLOR_ROLES.length; i++) {
    const role = COLOR_ROLES[i]!;
    const hex = roles[role];
    if (hex) {
      out[role] = { $value: hex, $type: "color", sampled: true };
    }
  }
  return out;
}
