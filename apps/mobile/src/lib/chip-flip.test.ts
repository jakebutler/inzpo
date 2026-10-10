import type { ColorRole } from '@inzpo/shared';
import { kitFixture } from '../../tests/fixtures';
import { chipFlipTiming, chipReadability, toggleChip } from './chip-flip';
import { primaryHue, roleHue } from './result-pins';

test('one chip owns the flip, another replaces it, and repeating it flips back', () => {
  let role: ColorRole | null = null;
  role = toggleChip(role, 'primary');
  expect(role).toBe('primary');
  role = toggleChip(role, 'secondary');
  expect(role).toBe('secondary');
  expect(toggleChip(role, 'secondary')).toBeNull();
});

test('reduced motion selects only a 150ms crossfade; normal motion lifts then rotates', () => {
  expect(chipFlipTiming(true)).toEqual({ path: 'crossfade', openMs: 150, closeMs: 150 });
  expect(chipFlipTiming(false)).toEqual({ path: 'rotate', openMs: 540, closeMs: 540 });
});

test('passing and failing copy uses the kit Text role against the tapped chip', () => {
  const kit = { ...kitFixture, roles: { ...kitFixture.roles, primary: '#d1cb9e', accent: '#426092', text: '#050404' } };
  expect(chipReadability(kit, 'primary')).toEqual({ hue: 'yellow', passes: true,
    copy: 'Your text color reads well on this yellow.' });
  expect(chipReadability({ ...kit, roles: { ...kit.roles, text: '#ffffff' } }, 'primary')).toEqual({
    hue: 'yellow', passes: false, copy: 'Your text color is hard to read on this yellow. Try a different one.',
  });
  expect(chipReadability(kit, 'text')).toMatchObject({ passes: true, copy: 'Your text color reads well on your background.' });
  expect(chipReadability({ ...kit, roles: { ...kit.roles, background: '#050404' } }, 'text')).toMatchObject({ passes: false, copy: 'Your text color is hard to read on your background. Try a different one.' });
  expect(chipReadability({ ...kit, roles: { ...kit.roles, background: null } }, 'text').copy).toBe('Add a background color to check how this text reads.');
  expect(chipReadability({ ...kit, roles: { ...kit.roles, text: null } }, 'primary').copy)
    .toBe('Add a text color to check how it reads here.');
});

test('every chip uses the same naming rules as the Primary annotation and ignores stale names', () => {
  const kit = { ...kitFixture, roles: { ...kitFixture.roles, primary: '#d1cb9e', accent: '#426092' }, colors: [
    { hex: '#D1CB9E', role: 'primary' as const, name: 'Sun-faded yellow', origin: 'sampled' },
    { hex: '#426092', role: 'accent' as const, name: 'Slice of blue sky', origin: 'sampled' },
    { hex: '#ff0000', role: 'secondary' as const, name: 'red', origin: 'sampled' },
  ] };
  expect(roleHue(kit, 'primary')).toBe(primaryHue(kit));
  expect(chipReadability(kit, 'accent').copy).toContain('this blue.');
  expect(roleHue(kit, 'secondary')).not.toBe('red');
});

test.each([['#767676', true], ['#777777', false]])('the 4.5:1 threshold decides the copy for Text %s', (text, passes) => {
  const kit = { ...kitFixture, roles: { ...kitFixture.roles, primary: '#ffffff', text: text as string } };
  expect(chipReadability(kit, 'primary').passes).toBe(passes);
});
