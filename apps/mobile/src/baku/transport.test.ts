import { anticipationAt, deform, durationFor, poseAt, SNOUT, TIMING } from './motion';
import { chipFlight, inhaleRibbon } from './transport';

const baku = { x: 118, y: 280, width: 280 };
const target = { x: 80, y: 430 };

test('ribbons have a visible tapered body only during the breath', () => {
  const source = { x: 120, y: 170 };
  expect(inhaleRibbon(0, 0, source, baku, 0).opacity).toBe(0);
  const ribbon = inhaleRibbon(.5, 0, source, baku, 0);
  expect(ribbon.opacity).toBeGreaterThan(.8);
  expect(ribbon.points.length).toBe(32);
  expect(ribbon.points[0]).toEqual(ribbon.points[31]);
  expect(ribbon.points[7].y).toBeLessThan(ribbon.points[24].y);
  expect(inhaleRibbon(1.2, 0, source, baku, 0).opacity).toBe(0);
});

test('the chip starts at the moving nostril, stays hidden until release, then follows a continuous exit jet', () => {
  const release = anticipationAt(0) + TIMING.anticipation + .10;
  const tip = deform(SNOUT.x, SNOUT.y, poseAt(release, 0));
  const start = chipFlight(release, 0, baku, target, 0);
  expect(start.x).toBeCloseTo(baku.x + tip.x * baku.width);
  expect(start.y).toBeCloseTo(baku.y + tip.y * baku.width * 2 / 3);
  expect(start.opacity).toBe(0);
  expect(chipFlight(release - 1, 0, baku, target, 0).opacity).toBe(0);
  const before = chipFlight(release + .12 - .00001, 0, baku, target, 0);
  const after = chipFlight(release + .12 + .00001, 0, baku, target, 0);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(.01);
});

test.each([0, 3, 8])('all six controls arrive at their targets when readiness is %ss', readyAt => {
  for (let index = 0; index < 6; index++) {
    const end = chipFlight(durationFor(readyAt), readyAt, baku, target, index);
    expect(end).toMatchObject({ ...target, opacity: 1, blankOpacity: 1, scale: 1, rotation: 0 });
  }
  expect(chipFlight(9, -1, baku, target, 0).opacity).toBe(0);
});
