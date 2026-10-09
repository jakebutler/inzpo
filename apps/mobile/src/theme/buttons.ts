import type { ViewStyle } from 'react-native';
import { INK } from './tokens';
import { ENAMEL_LIP, ENAMEL_RIM, LABEL_STOCK, SKY_ENAMEL } from './materials';

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
  primary: { fill: SKY_ENAMEL, border: ENAMEL_RIM, shadow: ENAMEL_LIP, ink: LABEL_STOCK },
  secondary: { fill: '#F7F1E6', border: '#FFFDF8', shadow: '#C5BBAB', ink: INK },
};

export const SAVE_PRESS = {
  rest: { sink: 0, lip: 4, shadowX: 4, shadowY: 8, shadowBlur: 12, darken: 0 },
  pressed: { sink: 2, lip: 1, shadowX: 1, shadowY: 2, shadowBlur: 4, darken: -0.07 },
} as const;

export function buttonSurface(primary: boolean, pressed: boolean, disabled: boolean, reducedMotion = false): ViewStyle {
  const colors = primary ? buttonColors.primary : buttonColors.secondary;
  const down = pressed && !disabled;
  const material = down ? SAVE_PRESS.pressed : SAVE_PRESS.rest;
  const restingShadow = primary ? { x: 4, y: 8, blur: 12 } : { x: 3, y: 7, blur: 11 };
  return {
    backgroundColor: down ? shade(colors.fill, primary ? material.darken : -0.04) : colors.fill,
    borderColor: colors.border,
    // Reduced motion changes opacity/face only; no physical compression.
    transform: [{ translateY: reducedMotion ? 0 : material.sink }],
    boxShadow: disabled ? [] : [
      { offsetX: 0, offsetY: reducedMotion ? 4 : material.lip, blurRadius: 0, color: colors.shadow },
      { offsetX: down && !reducedMotion ? material.shadowX : restingShadow.x,
        offsetY: down && !reducedMotion ? material.shadowY : restingShadow.y,
        blurRadius: down && !reducedMotion ? material.shadowBlur : restingShadow.blur, color: '#1C1B1928' },
      { inset: true, offsetX: 0, offsetY: 1, blurRadius: down ? 2 : 1, color: down ? '#1C1B1933' : '#FFFFFF77' },
      { inset: true, offsetX: 0, offsetY: -1, blurRadius: 1, color: '#00000019' },
    ],
  };
}
