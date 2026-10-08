import { COLOR_ROLES, emptyRoles, type RoleColors } from '@inzpo/shared';
import { hexToRgb01, OATMEAL, stripeColors, tintPixel } from './baku-tint';

const roles: RoleColors = {
  primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
  background: '#ffffff', surface: '#123456', text: '#000000',
};

test('hex conversion supports shared role hex formats', () => {
  expect(hexToRgb01(' #f80 ')).toEqual([1, 136 / 255, 0]);
  expect(hexToRgb01('#123456')).toEqual([18 / 255, 52 / 255, 86 / 255]);
});

test('stripe order follows COLOR_ROLES', () => {
  expect(stripeColors(roles, 6).map((stripe) => stripe.color))
    .toEqual(COLOR_ROLES.map((role) => hexToRgb01(roles[role]!)));
});

test('empty roles use oatmeal through the same tint formula', () => {
  stripeColors(emptyRoles(), 6).forEach((stripe) => {
    expect(stripe).toEqual({ color: hexToRgb01(OATMEAL), revealed: 1 });
    expect(tintPixel([0.5, 0.5, 0.5, 1], 128, 1, stripe.color)).toEqual([...hexToRgb01(OATMEAL), 1]);
  });
});

test('unrevealed stripes have zero coverage, even if a role is empty', () => {
  expect(stripeColors(emptyRoles(), 2).map((stripe) => stripe.revealed)).toEqual([1, 1, 0, 0, 0, 0]);
  const stripe = stripeColors(roles, 0)[0];
  const base = [0.3, 0.4, 0.5, 0.7] as const;
  expect(tintPixel(base, 200, stripe.revealed, stripe.color)).toEqual(base);
});

test('128 shade gives the exact role color and preserves base alpha', () => {
  expect(tintPixel([0.5, 0.5, 0.5, 0.4], 128, 1, [0.2, 0.6, 0.9])).toEqual([0.2, 0.6, 0.9, 0.4]);
});

test('shade multiplication clamps each channel to one', () => {
  expect(tintPixel([0, 0, 0, 1], 255, 1, [1, 0.8, 0.25])).toEqual([1, 1, 255 / 512, 1]);
});

test('antialiased mask coverage blends tinted color over the base', () => {
  expect(tintPixel([0.4, 0.4, 0.4, 0.6], 64, 0.25, [0.8, 0, 0.4]))
    .toEqual([0.4, 0.30000000000000004, 0.35000000000000003, 0.6]);
});
