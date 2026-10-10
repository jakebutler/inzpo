import type { ViewStyle } from 'react-native';
import { INK } from './tokens';
import { MATTE_BLUE_BASE, MATTE_BLUE_EDGE, LABEL_STOCK, MATTE_BLUE } from './materials';

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

export const BUTTON_RADIUS = 8;

export const buttonColors = {
  primary: { fill: MATTE_BLUE, border: MATTE_BLUE_EDGE, shadow: MATTE_BLUE_BASE, ink: LABEL_STOCK },
  secondary: { fill: '#EAE1D2', border: '#D1C5B3', shadow: '#B8AA95', ink: INK },
};

export const SAVE_PRESS = {
  rest: { sink: 0, lip: 3, shadowX: 1, shadowY: 4, shadowBlur: 5, darken: 0 },
  pressed: { sink: 2, lip: 1, shadowX: 0, shadowY: 1, shadowBlur: 2, darken: -0.07 },
} as const;

export function buttonSurface(primary: boolean, pressed: boolean, disabled: boolean, reducedMotion = false): ViewStyle {
  const colors = primary ? buttonColors.primary : buttonColors.secondary;
  const down = pressed && !disabled;
  const material = down ? SAVE_PRESS.pressed : SAVE_PRESS.rest;
  const depth = reducedMotion ? SAVE_PRESS.rest : material;
  return {
    borderRadius: BUTTON_RADIUS,
    backgroundColor: down ? shade(colors.fill, primary ? material.darken : -0.04) : colors.fill,
    borderColor: colors.border,
    // Reduced motion changes opacity/face only; no physical compression.
    transform: [{ translateY: reducedMotion ? 0 : material.sink }],
    // Short, soft contact shadows suggest pressed stock without a reflective bevel.
    boxShadow: disabled ? [] : [
      { offsetX: 0, offsetY: depth.lip, blurRadius: 1, color: colors.shadow },
      { offsetX: depth.shadowX, offsetY: depth.shadowY, blurRadius: depth.shadowBlur, color: '#1C1B1920' },
    ],
  };
}
