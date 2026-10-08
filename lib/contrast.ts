import { COLOR_ROLES } from "@/lib/db/schema";
import { INK, PAPER } from "@/lib/brand";
import type { RoleColors } from "@/lib/tokens";

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
  return contrastRatio(bandHex, pageHex) < 1.15;
}

export function saveControlColors(
  accent: string | null,
  background: string | null,
): { fill: string; ink: string } {
  const bg = background ?? PAPER;
  if (accent && contrastRatio(accent, bg) >= 3) {
    const ink = contrastRatio(PAPER, accent) >= contrastRatio(INK, accent) ? PAPER : INK;
    return { fill: accent, ink };
  }
  if (contrastRatio(INK, bg) >= 3) return { fill: INK, ink: PAPER };
  return { fill: PAPER, ink: INK };
}
