import { COLOR_ROLES, type RoleColors } from '@inzpo/shared';
import type { SharedValue } from 'react-native-reanimated';

export const OATMEAL = '#E4D9C6';
export type Rgb01 = readonly [number, number, number];
export type Rgba01 = readonly [number, number, number, number];
export type StripeProgress = readonly [
  SharedValue<number>, SharedValue<number>, SharedValue<number>,
  SharedValue<number>, SharedValue<number>, SharedValue<number>,
];
export type WipeMode = 0 | 1;
// Normalized sprite coordinates: a three-point soft edge at the 48pt art size.
export const STRIPE_FEATHER = 1.5 / 48;

export function hexToRgb01(hex: string): Rgb01 {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) throw new Error('Invalid Baku stripe hex');
  const full = clean.length === 3 ? clean.split('').map((digit) => digit + digit).join('') : clean;
  const channel = (offset: number) => parseInt(full.slice(offset, offset + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}

export const OATMEAL_RGB = hexToRgb01(OATMEAL);

export function stripeColors(roles: RoleColors): Rgb01[] {
  return COLOR_ROLES.map((role) => hexToRgb01(roles[role] ?? OATMEAL));
}

/** Mirrors SkSL in normalized sprite coordinates. Mode 1 has no moving edge. */
export function dyeCoverage(y: number, top: number, bottom: number, progress: number, mode: WipeMode): number {
  if (mode === 1) return Math.max(0, Math.min(1, progress));
  if (progress <= 0 || bottom <= top) return 0;
  if (progress >= 1) return 1;
  const front = top + progress * (bottom - top);
  const t = Math.max(0, Math.min(1, (y - front + STRIPE_FEATHER) / (2 * STRIPE_FEATHER)));
  return 1 - t * t * (3 - 2 * t);
}

/** Reference formula: straight RGBA/color in 0..1, shade in 0..255,
 * maskCoverage and dye in 0..1. Undyed yarn is shaded oatmeal, never base gray. */
export function tintPixel(base: Rgba01, shade: number, maskCoverage: number, color: Rgb01, dye = 1): Rgba01 {
  const coverage = Math.max(0, Math.min(1, maskCoverage));
  const mix = Math.max(0, Math.min(1, dye));
  const rgb = color.map((channel, index) => {
    const dyed = OATMEAL_RGB[index] * (1 - mix) + channel * mix;
    const tinted = Math.max(0, Math.min(1, dyed * shade / 128));
    return base[index] * (1 - coverage) + tinted * coverage;
  });
  return [rgb[0], rgb[1], rgb[2], base[3]];
}
