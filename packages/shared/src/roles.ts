import { COLOR_ROLES, type ColorRole, type RoleColors } from "./types";

export function emptyRoles(): RoleColors {
  return { primary: null, secondary: null, accent: null, background: null, surface: null, text: null };
}

/** Keep the first color for each role, matching the web's hex normalization. */
export function rolesFromColors(
  colors: ReadonlyArray<{ hex: string; role?: ColorRole | null }>,
): RoleColors {
  const roles = emptyRoles();
  for (const role of COLOR_ROLES) {
    const color = colors.find((entry) => entry.role === role);
    if (!color || !/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.hex.trim())) continue;
    const clean = color.hex.trim().replace("#", "").toLowerCase();
    const full = clean.length === 3 ? clean.split("").map((digit) => digit + digit).join("") : clean;
    roles[role] = `#${full}`;
  }
  return roles;
}

export function filledRoles(roles: RoleColors): ColorRole[] {
  return COLOR_ROLES.filter((role) => roles[role] !== null);
}
