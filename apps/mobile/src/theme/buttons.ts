import type { ViewStyle } from 'react-native';
import { INK, PAPER, VERMILION } from './tokens';

/** Mix a hex color toward white (positive) or black (negative). */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace(/^#/, '');
  if (!/^[\da-f]{6}$/i.test(clean) || !Number.isFinite(amount) || Math.abs(amount) > 1) {
    throw new Error('Invalid button shade');
  }
  const target = amount >= 0 ? 255 : 0;
  return '#' + [0, 2, 4].map((offset) => {
    const channel = parseInt(clean.slice(offset, offset + 2), 16);
    return Math.round(channel + (target - channel) * Math.abs(amount)).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

export const buttonColors = {
  primary: { fill: VERMILION, border: shade(VERMILION, 0.18), shadow: shade(VERMILION, -0.25) },
  secondary: { fill: shade(PAPER, 0.35), border: shade(INK, 0.38), shadow: shade(PAPER, -0.35) },
};

export function buttonSurface(primary: boolean, pressed: boolean, disabled: boolean): ViewStyle {
  const colors = primary ? buttonColors.primary : buttonColors.secondary;
  return {
    backgroundColor: pressed && !disabled ? shade(colors.fill, -0.04) : colors.fill,
    borderColor: pressed && !disabled ? shade(colors.border, -0.04) : colors.border,
    boxShadow: disabled ? [] : [{
      offsetX: 0, offsetY: pressed ? 1 : 2, blurRadius: pressed ? 2 : 4,
      spreadDistance: 0, color: colors.shadow + '26',
    }],
  };
}
