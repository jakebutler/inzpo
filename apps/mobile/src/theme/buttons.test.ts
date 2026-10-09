import { contrastRatio } from '@/lib/contrast';
import { INK, PAPER, VERMILION } from './tokens';
import { buttonColors, buttonSurface, shade } from './buttons';
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
  expect(contrastRatio(buttonColors.secondary.border, PAPER)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(INK, buttonColors.secondary.fill)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(PAPER, VERMILION)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(shade(INK, 0.28), PAPER)).toBeGreaterThanOrEqual(4.5);
});

test.each([true, false])('pressed surface tightens shadow and darkens fill, disabled has no shadow (%s)', (primary) => {
  const resting = buttonSurface(primary, false, false);
  const pressed = buttonSurface(primary, true, false);
  expect(pressed.backgroundColor).toBe(shade(resting.backgroundColor as string, -0.04));
  expect(resting.boxShadow).toEqual([expect.objectContaining({ offsetY: 2, blurRadius: 4 })]);
  expect(pressed.boxShadow).toEqual([expect.objectContaining({ offsetY: 1, blurRadius: 2 })]);
  expect(buttonSurface(primary, true, true)).toEqual(buttonSurface(primary, false, true));
  expect(buttonSurface(primary, false, true).boxShadow).toEqual([]);
});

test('resting Baku is 160pt on a tall 390pt phone and shrinks on an SE', () => {
  expect(restingBakuSize(390, 760)).toBe(160);
  expect(restingBakuSize(375, 647)).toBeCloseTo(124.2);
  // SE: 48pt padding + 80pt gaps + 132pt heading + 48pt helper + 104pt controls.
  expect(restingBakuSize(375, 647) + 48 + 80 + 132 + 48 + 104).toBeLessThan(647);
});
