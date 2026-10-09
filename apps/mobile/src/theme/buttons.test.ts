import { contrastRatio } from '@/lib/contrast';
import { INK, PAPER } from './tokens';
import { buttonColors, buttonSurface, SAVE_PRESS, shade } from './buttons';
import { LABEL_STOCK } from './materials';
import { restingBakuSize } from './sign-in';

test('hex shades mix toward white or black with predictable endpoints', () => {
  expect(shade('#123456', 0)).toBe('#123456');
  expect(shade('#123456', 1)).toBe('#FFFFFF');
  expect(shade('#123456', -1)).toBe('#000000');
  expect(shade('#000000', 0.5)).toBe('#808080');
  expect(shade('#FFFFFF', -0.5)).toBe('#808080');
  expect(() => shade('#oops', 0.1)).toThrow();
  expect(() => shade(INK, 2)).toThrow();
});

test('button borders, labels and helper ink retain accessible contrast', () => {
  expect(contrastRatio(INK, buttonColors.secondary.fill)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(LABEL_STOCK, buttonColors.primary.fill)).toBeGreaterThanOrEqual(5.9674);
  expect(contrastRatio(shade(INK, 0.28), PAPER)).toBeGreaterThanOrEqual(4.5);
});

test.each([true, false])('pressed surface tightens shadow and darkens fill, disabled has no shadow (%s)', (primary) => {
  const resting = buttonSurface(primary, false, false);
  const pressed = buttonSurface(primary, true, false);
  expect(pressed.backgroundColor).toBe(shade(resting.backgroundColor as string, primary ? -0.07 : -0.04));
  expect(resting.boxShadow).toEqual(expect.arrayContaining([
    expect.objectContaining({ offsetY: 4, blurRadius: 0 }),
    expect.objectContaining({ offsetX: primary ? 4 : 3, offsetY: primary ? 8 : 7, blurRadius: primary ? 12 : 11 }),
  ]));
  expect(pressed.boxShadow).toEqual(expect.arrayContaining([
    expect.objectContaining({ offsetY: 1, blurRadius: 0 }),
    expect.objectContaining({ offsetX: 1, offsetY: 2, blurRadius: 4 }),
  ]));
  expect(pressed.transform).toEqual([{ translateY: 2 }]);
  expect(buttonSurface(primary, true, true)).toEqual(buttonSurface(primary, false, true));
  expect(buttonSurface(primary, false, true).boxShadow).toEqual([]);
});

test('Save material locks the designer press values and reduced motion keeps the face level', () => {
  expect(SAVE_PRESS).toEqual({
    rest: { sink: 0, lip: 4, shadowX: 4, shadowY: 8, shadowBlur: 12, darken: 0 },
    pressed: { sink: 2, lip: 1, shadowX: 1, shadowY: 2, shadowBlur: 4, darken: -0.07 },
  });
  const pressed = buttonSurface(true, true, false, true);
  expect(pressed.transform).toEqual([{ translateY: 0 }]);
  expect(pressed.backgroundColor).toBe('#3D5988');
  expect(contrastRatio(LABEL_STOCK, pressed.backgroundColor as string)).toBeGreaterThanOrEqual(5.9674);
});

test('resting Baku is 160pt on a tall 390pt phone and shrinks on an SE', () => {
  expect(restingBakuSize(390, 760)).toBe(160);
  expect(restingBakuSize(375, 647)).toBeCloseTo(124.2);
  // SE: 48pt padding + 80pt gaps + 132pt heading + 48pt helper + 104pt controls.
  expect(restingBakuSize(375, 647) + 48 + 80 + 132 + 48 + 104).toBeLessThan(647);
});
