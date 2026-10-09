import { kitFixture } from '../../tests/fixtures';
import { FALLBACK_PINS, photoPins, primaryHue, roleSample } from './result-pins';

test('missing or null coordinates use a stable sample without mutating the kit', () => {
  expect(roleSample(kitFixture, 'primary')).toEqual(FALLBACK_PINS.primary);
  const kit = { ...kitFixture, colors: [{ hex: kitFixture.roles.primary!, role: 'primary' as const, name: null, origin: 'extracted', pinX: null, pinY: null }] };
  expect(roleSample(kit, 'primary')).toEqual(FALLBACK_PINS.primary);
  expect(photoPins(kit, 248, 330)).toHaveLength(5);
  expect(roleSample(kit, 'accent')).toBeNull();
});

test.each([[0, 1], [0.23, 0.44]])('real coordinates override the fallback, including edges (%s/%s)', (pinX, pinY) => {
  const kit = { ...kitFixture, colors: [{ hex: '#B35831', role: 'primary' as const, name: 'Warm orange', origin: 'sampled', pinX, pinY }] };
  expect(roleSample(kit, 'primary')).toEqual({ x: pinX, y: pinY });
  expect(primaryHue(kit)).toBe('orange');
});

test.each([[NaN, 0.2], [-1, 0.2], [0.2, 2], [undefined, 0.2]])('invalid, incomplete or stale pins fall back (%s/%s)', (pinX, pinY) => {
  const color = { hex: kitFixture.roles.primary!, role: 'primary' as const, name: null, origin: 'sampled', pinX, pinY };
  expect(roleSample({ ...kitFixture, colors: [color] }, 'primary')).toEqual(FALLBACK_PINS.primary);
  expect(roleSample({ ...kitFixture, colors: [{ ...color, hex: '#d1cb9e', pinX: 0.2, pinY: 0.4 }] }, 'primary')).toEqual(FALLBACK_PINS.primary);
});

test('reference markers retain displaced edge leaders and the primary arrow endpoint', () => {
  const kit = { ...kitFixture, photo: { ...kitFixture.photo!, width: 1500, height: 2000 },
    roles: { primary: '#d1cb9e', secondary: '#6f6c58', accent: '#426092', background: '#d0c7b2', surface: null, text: '#050404' } };
  const pins = photoPins(kit, 248, 330);
  const primary = pins.find((pin) => pin.role === 'primary')!;
  // 248x330 top-aligned cover uses width/1500, with no horizontal crop.
  expect(primary.marker.x).toBeCloseTo(307 * 248 / 1500, 5);
  expect(primary.marker.y).toBeCloseTo(889 * 248 / 1500, 5);
  const accent = pins.find((pin) => pin.role === 'accent')!;
  expect(accent.marker).toMatchObject({ y: 35 });
  expect(accent.target.y).toBeCloseTo(13.37, 1);
  expect(pins.find((pin) => pin.role === 'text')!.marker.x).toBe(45);
  expect(primaryHue(kit)).toBe('yellow');
});
