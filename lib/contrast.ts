import { COLOR_ROLES } from "@/lib/db/schema";
import { INK, PAGE_BAND_HAIRLINE_RATIO, PAPER } from "@/lib/brand";
import type { RoleColors } from "@/lib/tokens";
import { FIX_ORIGIN, sampledColors, type ColorWithRole } from "@/lib/derived-roles";
import { isHexColor } from "@/lib/colors";

function srgbToLin(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast ratio, or null unless both text and background are filled. */
export function textOnBackgroundContrast(roles: RoleColors): number | null {
  if (!roles.text || !roles.background) return null;
  return contrastRatio(roles.text, roles.background);
}

const WHITE = "#ffffff";
const BLACK = "#000000";

/** Black or white label ink that meets 4.5:1 on the swatch, preferring the stronger ratio. */
export function swatchInk(backgroundHex: string): "#ffffff" | "#000000" {
  const white = contrastRatio(WHITE, backgroundHex);
  const black = contrastRatio(BLACK, backgroundHex);
  if (white >= 4.5 && white >= black) return WHITE;
  if (black >= 4.5 && black > white) return BLACK;
  return white >= black ? WHITE : BLACK;
}

export function swatchHairline(backgroundHex: string): string {
  return swatchInk(backgroundHex) === WHITE ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)";
}

export function contrastLineCopy(roles: RoleColors): string {
  const hasText = Boolean(roles.text);
  const hasBg = Boolean(roles.background);
  if (!hasText && !hasBg) return "Needs text and background colors to check contrast.";
  if (!hasText) return "Needs a text color to check contrast.";
  if (!hasBg) return "Needs a background color to check contrast.";
  const ratio = textOnBackgroundContrast(roles);
  return `${ratio!.toFixed(1)}:1`;
}

/** Band label: a kit color at 4.5:1, else ink or paper. */
export function bandLabelColor(bandHex: string, kit: RoleColors): string {
  const candidates: string[] = [];
  for (const role of COLOR_ROLES) {
    const hex = kit[role];
    if (hex) candidates.push(hex);
  }
  candidates.push(INK, PAPER);
  let best = INK;
  let bestRatio = 0;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, bandHex);
    if (ratio >= 4.5 && ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  if (bestRatio >= 4.5) return best;
  return contrastRatio(INK, bandHex) >= contrastRatio(PAPER, bandHex) ? INK : PAPER;
}

export function matchesPageBackground(bandHex: string, pageHex: string): boolean {
  return contrastRatio(bandHex, pageHex) < PAGE_BAND_HAIRLINE_RATIO;
}

export function saveControlColors(
  accent: string | null,
  background: string | null,
): { fill: string; ink: string } {
  const bg = background ?? PAPER;
  let fill = PAPER;
  if (accent && contrastRatio(accent, bg) >= 3) fill = accent;
  else if (contrastRatio(INK, bg) >= 3) fill = INK;
  else fill = PAPER;
  const paperRatio = contrastRatio(PAPER, fill);
  const inkRatio = contrastRatio(INK, fill);
  if (paperRatio >= 4.5 && paperRatio >= inkRatio) return { fill, ink: PAPER };
  return { fill, ink: INK };
}

/**
 * Kit text on kit background at 4.5:1, else ink or paper.
 * Same gate as Save (preferred token, then INK/PAPER) with AA body contrast.
 */
export function gatedTextColor(
  preferred: string | null | undefined,
  background: string,
  minRatio = 4.5,
): string {
  const bg = background || PAPER;
  if (preferred && contrastRatio(preferred, bg) >= minRatio) return preferred;
  return contrastRatio(INK, bg) >= contrastRatio(PAPER, bg) ? INK : PAPER;
}

/** Prefer the strongest passing real kit colour before using the chrome fallback. */
export function textContrastFix(background: string, colors: readonly ColorWithRole[]): ColorWithRole {
  let best: ColorWithRole | undefined;
  let bestRatio = 0;
  for (const color of sampledColors(colors)) {
    if (!isHexColor(color.hex)) continue;
    if (color.origin === FIX_ORIGIN && (color.pinX == null || color.pinY == null)) continue;
    const ratio = contrastRatio(color.hex, background);
    if (ratio >= 4.5 && ratio > bestRatio) {
      best = color;
      bestRatio = ratio;
    }
  }
  return best ?? { hex: gatedTextColor(null, background) };
}

/** Accessible page chrome only; the kit's measured colours stay untouched. */
export function pageChromeColors(roles: RoleColors): { background: string; ink: string } {
  const background = roles.background ?? PAPER;
  const ink = gatedTextColor(roles.text, background);
  if (contrastRatio(ink, background) >= 4.5) return { background, ink };
  return { background: PAPER, ink: INK };
}

export function aaPassLabel(ratio: number): "AA pass" | "fail" {
  return ratio >= 4.5 ? "AA pass" : "fail";
}
