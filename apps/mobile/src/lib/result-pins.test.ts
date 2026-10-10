import { kitFixture } from '../../tests/fixtures';
import { COLOR_ROLES, emptyRoles } from '@inzpo/shared';
import { resultLayout, rotatedBounds } from './result-layout';
import { photoPins, primaryHue, roleSample } from './result-pins';

test('missing or null coordinates have no claimed sample without mutating the kit', () => {
  expect(roleSample({ ...kitFixture, colors: [] }, 'primary')).toBeNull();
  const kit = { ...kitFixture, colors: [{ hex: kitFixture.roles.primary!, role: 'primary' as const, name: null, origin: 'extracted', pinX: null, pinY: null }] };
  expect(roleSample(kit, 'primary')).toBeNull();
  expect(photoPins(kit, 248, 330)).toHaveLength(0);
  expect(roleSample(kit, 'accent')).toBeNull();
});

test.each([[0, 1], [0.23, 0.44]])('real coordinates produce pins, including edges (%s/%s)', (pinX, pinY) => {
  const kit = { ...kitFixture, colors: [{ hex: '#B35831', role: 'primary' as const, name: 'Warm orange', origin: 'sampled', pinX, pinY }] };
  expect(roleSample(kit, 'primary')).toEqual({ x: pinX, y: pinY });
  expect(primaryHue(kit)).toBe('orange');
});

test.each([[NaN, 0.2], [-1, 0.2], [0.2, 2], [undefined, 0.2]])('invalid, incomplete or stale pins are absent (%s/%s)', (pinX, pinY) => {
  const color = { hex: kitFixture.roles.primary!, role: 'primary' as const, name: null, origin: 'sampled', pinX, pinY };
  expect(roleSample({ ...kitFixture, colors: [color] }, 'primary')).toBeNull();
  expect(roleSample({ ...kitFixture, colors: [{ ...color, hex: '#d1cb9e', pinX: 0.2, pinY: 0.4 }] }, 'primary')).toBeNull();
});

test('reference markers retain displaced edge leaders and the primary arrow endpoint', () => {
  const kit = { ...kitFixture, photo: { ...kitFixture.photo!, width: 1500, height: 2000 },
    roles: { primary: '#d1cb9e', secondary: '#6f6c58', accent: '#426092', background: '#d0c7b2', surface: null, text: '#050404' } };
  const samples = [{ x: 307 / 1500, y: 889 / 2000 }, { x: 1288 / 1500, y: 358 / 2000 },
    { x: 120 / 1500, y: 81 / 2000 }, { x: 1315 / 1500, y: 585 / 2000 }, { x: .5, y: .6 }, { x: 169 / 1500, y: 129 / 2000 }];
  kit.colors = COLOR_ROLES.flatMap((role, i) => kit.roles[role] ? [{ role, hex: kit.roles[role]!, name: null, origin: 'region', pinX: samples[i].x, pinY: samples[i].y }] : []);
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


test('coincident samples retain separate pins for every filled role', () => {
  const colors = Object.entries(kitFixture.roles).flatMap(([role, hex]) => hex ? [{ role: role as keyof typeof kitFixture.roles, hex, name: null, origin: 'sampled', pinX: 0.5, pinY: 0.5 }] : []);
  const pins = photoPins({ ...kitFixture, colors }, 248, 330);
  expect(pins.map((pin) => pin.role)).toEqual(['primary', 'secondary', 'background', 'surface', 'text']);
  for (let i = 0; i < pins.length; i++) for (const other of pins.slice(i + 1)) {
    expect(Math.hypot(pins[i].marker.x - other.marker.x, pins[i].marker.y - other.marker.y)).toBeGreaterThanOrEqual(18);
  }
});

test.each(Array.from({ length: 64 }, (_, mask) => mask))('pin count equals filled-role count for role mask %i, even with identical colors and samples', (mask) => {
  const roles = emptyRoles();
  COLOR_ROLES.forEach((role, index) => { if (mask & (1 << index)) roles[role] = '#123456'; });
  const filledRoles = COLOR_ROLES.filter((role) => roles[role]);
  const colors = filledRoles.map((role) => ({ role, hex: '#123456', name: null, origin: 'sampled', pinX: 0.5, pinY: 0.95 }));
  const kit = { ...kitFixture, roles, colors };
  const pins = photoPins(kit, 248, 330, 250);
  expect(pins).toHaveLength(filledRoles.length);
  expect(pins.map((pin) => pin.role)).toEqual(filledRoles);
  for (let i = 0; i < pins.length; i++) for (const other of pins.slice(i + 1)) {
    expect(Math.hypot(pins[i].marker.x - other.marker.x, pins[i].marker.y - other.marker.y)).toBeGreaterThanOrEqual(18);
  }
});

test.each([{ width: 390, height: 844 }, { width: 375, height: 667 }])('bottom samples keep every ring above the rendered chip pile at $width', (screen) => {
  const layout = resultLayout(screen);
  const colors = COLOR_ROLES.flatMap((role) => kitFixture.roles[role]
    ? [{ role, hex: kitFixture.roles[role]!, name: null, origin: 'sampled', pinX: 0.5, pinY: 0.95 }] : []);
  const pins = photoPins({ ...kitFixture, colors }, layout.printWidth - 26, layout.photoHeight, layout.pinHeight);
  const pileTop = layout.printHeight - 113 + Math.min(...layout.slots.map((slot) => rotatedBounds(slot).top));
  for (const pin of pins) {
    expect(pin.marker.y + 13 + 10).toBeLessThan(pileTop);
    // Leaders retain the mapped source point even when the ring is nudged up.
    expect(pin.target.y).toBeCloseTo(layout.photoHeight * 0.95);
    expect(pin.marker.y).toBeLessThan(pin.target.y);
  }
});
