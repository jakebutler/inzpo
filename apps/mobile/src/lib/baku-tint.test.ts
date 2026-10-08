import { COLOR_ROLES, emptyRoles, type RoleColors } from '@inzpo/shared';
import { dyeCoverage, hexToRgb01, OATMEAL, OATMEAL_RGB, STRIPE_FEATHER, stripeColors, tintPixel } from './baku-tint';

const roles: RoleColors = {
  primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
  background: '#ffffff', surface: '#123456', text: '#000000',
};

test('hex conversion supports shared role hex formats', () => {
  expect(hexToRgb01(' #f80 ')).toEqual([1, 136 / 255, 0]);
  expect(hexToRgb01('#123456')).toEqual([18 / 255, 52 / 255, 86 / 255]);
});

test('stripe order follows COLOR_ROLES', () => {
  expect(stripeColors(roles))
    .toEqual(COLOR_ROLES.map((role) => hexToRgb01(roles[role]!)));
});

test('empty roles stay oatmeal regardless of dye progress', () => {
  stripeColors(emptyRoles()).forEach((color) => {
    expect(color).toEqual(hexToRgb01(OATMEAL));
    for (const progress of [0, 0.5, 1]) {
      expect(tintPixel([0.5, 0.5, 0.5, 1], 128, 1, color, progress)).toEqual([...OATMEAL_RGB, 1]);
    }
  });
});

test('undyed stripes shade oatmeal instead of retaining base gray', () => {
  const base = [0.3, 0.4, 0.5, 0.7] as const;
  const role = stripeColors(roles)[0];
  expect(tintPixel(base, 128, 1, role, 0)).toEqual([...OATMEAL_RGB, base[3]]);
  expect(tintPixel(base, 64, 1, role, 0)).toEqual([...OATMEAL_RGB.map((c) => c / 2), base[3]]);
  expect(tintPixel(base, 128, 0, role, 0)).toEqual(base);
});

test('dye blends oatmeal and role before multiplying shade and clamping', () => {
  const role = [0, 0, 0] as const;
  expect(tintPixel([0, 0, 0, 0.5], 255, 1, role, 0.5))
    .toEqual([...OATMEAL_RGB.map((c) => c * 255 / 256), 0.5]);
});

test('edge dye moves top to bottom, with a smooth feather and exact endpoints', () => {
  expect(dyeCoverage(0.4, 0.3, 0.7, 0.5, 0)).toBe(1);
  expect(dyeCoverage(0.5, 0.3, 0.7, 0.5, 0)).toBeCloseTo(0.5);
  expect(dyeCoverage(0.6, 0.3, 0.7, 0.5, 0)).toBe(0);
  expect(dyeCoverage(0.5 - STRIPE_FEATHER / 2, 0.3, 0.7, 0.5, 0)).toBeCloseTo(0.84375);
  expect(dyeCoverage(0.5 + STRIPE_FEATHER / 2, 0.3, 0.7, 0.5, 0)).toBeCloseTo(0.15625);
  for (const y of [0, 0.3, 0.5, 0.7, 1]) {
    expect(dyeCoverage(y, 0.3, 0.7, 0, 0)).toBe(0);
    expect(dyeCoverage(y, 0.3, 0.7, 1, 0)).toBe(1);
  }
  expect(dyeCoverage(0.5, 0, 0, 0.5, 0)).toBe(0);
});

test('reduced-motion dye coverage is uniform across the stripe', () => {
  for (const y of [0, 0.3, 0.5, 0.7, 1]) {
    expect(dyeCoverage(y, 0.3, 0.7, 0.25, 1)).toBe(0.25);
    expect(dyeCoverage(y, 0.3, 0.7, -1, 1)).toBe(0);
    expect(dyeCoverage(y, 0.3, 0.7, 2, 1)).toBe(1);
  }
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
