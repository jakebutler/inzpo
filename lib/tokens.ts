import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { isHexColor, normalizeHex } from "@/lib/colors";

export type RoleColors = Record<ColorRole, string | null>;

export interface DesignTokenColor {
  $value: string;
  $type: "color";
  fallback?: true;
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
  colors: ReadonlyArray<{ hex: string; role?: ColorRole | null }>,
): RoleColors {
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

function nearestFilledHex(roles: RoleColors, index: number): string | null {
  for (let distance = 1; distance < COLOR_ROLES.length; distance++) {
    const left = COLOR_ROLES[index - distance];
    if (left && roles[left]) return roles[left];
    const right = COLOR_ROLES[index + distance];
    if (right && roles[right]) return roles[right];
  }
  return null;
}

/** Empty roles fall back to the nearest real color and are marked fallback: true. */
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

export function designTokenColors(roles: RoleColors): Record<ColorRole, DesignTokenColor> | null {
  if (filledRoles(roles).length === 0) return null;
  const out = {} as Record<ColorRole, DesignTokenColor>;
  for (let i = 0; i < COLOR_ROLES.length; i++) {
    const role = COLOR_ROLES[i]!;
    const hex = roles[role];
    if (hex) {
      out[role] = { $value: hex, $type: "color" };
      continue;
    }
    const fallback = nearestFilledHex(roles, i);
    if (!fallback) return null;
    out[role] = { $value: fallback, $type: "color", fallback: true };
  }
  return out;
}
