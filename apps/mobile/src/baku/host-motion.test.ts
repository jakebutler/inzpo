import { balloonFlight, flightSeed, HOST_FLIGHT, hostDurationFor, intakeDust } from './host-motion';
import { anticipationAt, coatFillAt, intakePoseAt, performancePoseAt, TIMING } from './motion';
const origin = { x: 118, y: 410, width: 280 }, target = { x: 10, y: 754, width: 72 };
const bounds = { width: 390, height: 844 };

test('intake stays subtly open and uncolored during a long upload, then blends into chewing', () => {
  for (const time of [.5, 2, 15, 60]) {
    const pose = intakePoseAt(time);
    expect(pose.fullness).toBe(0);
    expect(pose.cheekL).toBe(0);
    expect(pose.trunkFlare).toBeGreaterThan(.15);
    expect(coatFillAt(0, null)).toBe(0);
    expect(performancePoseAt(TIMING.inhale, null, time, 1)).toEqual(pose);
    expect(performancePoseAt(TIMING.inhale + .32, null, time, 0).beat).toBe('chew');
  }
  expect(intakeDust(2, 0, 4, { x: 180, y: 300 }, origin, 1.6, -1).opacity).toBe(0);
});

test.each([0, 8, 30])('the balloon leaves after all swatches launch, varies by capture, and settles exactly for readiness %s', ready => {
  const start = anticipationAt(ready) + TIMING.anticipation + HOST_FLIGHT.delay;
  const initial = { x: 258, y: 410 + 280 / 3, scale: 1, rotation: 0 };
  expect(balloonFlight(start, ready, origin, target, .2, bounds)).toEqual(initial);
  expect(balloonFlight(99, -1, origin, target, .2, bounds)).toEqual(initial);
  expect(HOST_FLIGHT.delay).toBeGreaterThan(.1 + 5 * .032);
  expect(balloonFlight(start + .7, ready, origin, target, .2, bounds))
    .not.toEqual(balloonFlight(start + .7, ready, origin, target, .8, bounds));
  for (let t = start; t < hostDurationFor(ready); t += .02) {
    const flight = balloonFlight(t, ready, origin, target, .2, bounds);
    const next = balloonFlight(t + .0001, ready, origin, target, .2, bounds);
    expect(Math.hypot(next.x - flight.x, next.y - flight.y)).toBeLessThan(.15);
    expect(flight.x).toBeGreaterThan(0); expect(flight.x).toBeLessThan(bounds.width);
    expect(flight.y).toBeGreaterThan(0); expect(flight.y).toBeLessThan(bounds.height);
  }
  expect(balloonFlight(hostDurationFor(ready) + .001, ready, origin, target, .2, bounds))
    .toEqual({ x: 46, y: 778, scale: 72 / 280, rotation: 0 });
  expect(flightSeed('capture-123')).toBe(flightSeed('capture-123'));
});
