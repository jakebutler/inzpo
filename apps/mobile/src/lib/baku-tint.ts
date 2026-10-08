import { COLOR_ROLES, type RoleColors } from '@inzpo/shared';

export const OATMEAL = '#E4D9C6';
export type Rgb01 = readonly [number, number, number];
export type Rgba01 = readonly [number, number, number, number];
export type StripeColor = { color: Rgb01; revealed: 0 | 1 };

export function hexToRgb01(hex: string): Rgb01 {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) throw new Error('Invalid Baku stripe hex');
  const full = clean.length === 3 ? clean.split('').map((digit) => digit + digit).join('') : clean;
  const channel = (offset: number) => parseInt(full.slice(offset, offset + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}

export function stripeColors(roles: RoleColors, revealedCount: number): StripeColor[] {
  return COLOR_ROLES.map((role, index) => ({
    color: hexToRgb01(roles[role] ?? OATMEAL),
    revealed: index < revealedCount ? 1 : 0,
  }));
}

/** Reference formula: straight RGBA/color in 0..1, shade in 0..255,
 * maskCoverage in 0..1. An unrevealed stripe passes zero coverage. */
export function tintPixel(base: Rgba01, shade: number, maskCoverage: number, color: Rgb01): Rgba01 {
  const coverage = Math.max(0, Math.min(1, maskCoverage));
  const rgb = color.map((channel, index) => {
    const tinted = Math.max(0, Math.min(1, channel * shade / 128));
    return base[index] * (1 - coverage) + tinted * coverage;
  });
  return [rgb[0], rgb[1], rgb[2], base[3]];
}
