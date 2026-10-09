import type { CSSProperties } from "react";
import { PHOTO_FOLD_CSS } from "@/lib/brand";
import { pageChromeColors, saveControlColors } from "@/lib/contrast";
import type { RoleColors } from "@/lib/tokens";

/** Inline kit CSS vars so Save and the page share colors on the first paint. */
export function kitWearStyle(roles: RoleColors): CSSProperties {
  const { background: pageBg, ink: pageInk } = pageChromeColors(roles);
  const save = saveControlColors(roles.accent, pageBg);
  return {
    backgroundColor: pageBg,
    color: pageInk,
    ["--background" as string]: pageBg,
    ["--foreground" as string]: pageInk,
    ["--primary" as string]: save.fill,
    ["--primary-foreground" as string]: save.ink,
    ["--photo-fold-h" as string]: PHOTO_FOLD_CSS,
  };
}
