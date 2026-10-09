import { INK, PAPER } from '@/theme/tokens';

/** sRGB relative luminance, with the nonlinear channels converted to linear light. */
export function luminance(hex: string): number {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) throw new Error('Invalid hex color');
  const full = clean.length === 3 ? clean.split('').map((digit) => digit + digit).join('') : clean;
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function contrastTextColor(background: string): typeof INK | typeof PAPER {
  return contrastRatio(background, INK) >= contrastRatio(background, PAPER) ? INK : PAPER;
}
