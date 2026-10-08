import { contrastRatio, contrastTextColor, luminance } from './contrast';
import { INK, PAPER } from '@/theme/tokens';

test('black and white have the expected relative luminance and contrast', () => {
  expect(luminance('#000000')).toBe(0);
  expect(luminance('#ffffff')).toBe(1);
  expect(contrastRatio('#000', '#fff')).toBe(21);
});

test('short hex colors are equivalent to full hex colors', () => {
  expect(luminance('#abc')).toBe(luminance('#aabbcc'));
  expect(luminance('ABC')).toBe(luminance('#aabbcc'));
});

test.each(['#ffffff', '#e4d9c6', '#ffeeaa'])('picks ink on light %s', (color) => {
  expect(contrastTextColor(color)).toBe(INK);
});

test.each(['#000000', '#1c1b19', '#001155'])('picks paper on dark %s', (color) => {
  expect(contrastTextColor(color)).toBe(PAPER);
});

test.each(['#b35831', '#7a7a7a', '#c9341f', '#615343'])('chooses the higher actual contrast for %s', (color) => {
  const chosen = contrastTextColor(color);
  const alternative = chosen === INK ? PAPER : INK;
  expect(contrastRatio(color, chosen)).toBeGreaterThanOrEqual(contrastRatio(color, alternative));
});

test('rejects malformed color values', () => {
  expect(() => luminance('#zzzzzz')).toThrow('Invalid hex color');
});
