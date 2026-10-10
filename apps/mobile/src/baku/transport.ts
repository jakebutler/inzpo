import { anticipationAt, clamp, colorInhaleAt, deform, durationFor, poseAt, SNOUT, SNOUT_INNER, TIMING } from './motion';

export type Point = { x: number; y: number };
export type Emitter = Point & { width: number };

function bezier(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  'worklet';
  const k = 1 - t;
  return { x: k ** 3 * a.x + 3 * k ** 2 * t * b.x + 3 * k * t ** 2 * c.x + t ** 3 * d.x,
    y: k ** 3 * a.y + 3 * k ** 2 * t * b.y + 3 * k * t ** 2 * c.y + t ** 3 * d.y };
}

/** Study bb16e1e: repeated tapered ribbons accelerate into the moving nostril.
 * Native sources are the actual measured photo samples, not an invented origin. */
export function inhaleRibbon(time: number, readyAt: number | null, source: Point, baku: Emitter, index: number) {
  'worklet';
  if (readyAt === null || time < readyAt) return { points: [] as Point[], opacity: 0 };
  const pose = poseAt(time, readyAt);
  if (pose.breath <= 0) return { points: [] as Point[], opacity: 0 };
  const tip = deform(SNOUT.x, SNOUT.y, pose);
  const snout = { x: baku.x + tip.x * baku.width, y: baku.y + tip.y * baku.width * 2 / 3 };
  const c1 = { x: source.x + (snout.x - source.x) * .35, y: source.y - 25 - index * 5 };
  const c2 = { x: snout.x - 34, y: snout.y - 14 + index * 3 };
  const progress = ((time - colorInhaleAt(readyAt)) * 1.5 + index * .15) % 1;
  const head = clamp(progress * progress * 1.65), tail = Math.max(0, head - .57);
  const top: Point[] = [], bottom: Point[] = [];
  for (let n = 0; n <= 15; n++) {
    const u = tail + (head - tail) * n / 15;
    const point = bezier(source, c1, c2, snout, u);
    const thickness = (1 - u) * (3.8 + index * .25) * Math.sin(n / 15 * Math.PI);
    top.push({ x: point.x, y: point.y - thickness });
    bottom.unshift({ x: point.x, y: point.y + thickness });
  }
  return { points: top.concat(bottom), opacity: pose.breath * .88 };
}

/** Study bb16e1e: a tight jet clears the nostril before fanning into controls. */
export function chipFlight(time: number, readyAt: number, baku: Emitter, target: Point, index: number, count = 6) {
  'worklet';
  const release = anticipationAt(Math.max(0, readyAt)) + TIMING.anticipation + .10;
  const local = time - release - index * .032;
  const launchPose = poseAt(release + index * .032, Math.max(0, readyAt));
  const tip = deform(SNOUT.x, SNOUT.y, launchPose), inner = deform(SNOUT_INNER.x, SNOUT_INNER.y, launchPose);
  const launch = { x: baku.x + tip.x * baku.width, y: baku.y + tip.y * baku.width * 2 / 3 };
  const axis = { x: (tip.x - inner.x) * baku.width, y: (tip.y - inner.y) * baku.width * 2 / 3 };
  const length = Math.hypot(axis.x, axis.y) || 1;
  const direction = { x: axis.x / length, y: axis.y / length };
  const flight = .55 + index * .02, exitTime = .12;
  const jet = clamp(local / exitTime), fan = clamp((local - exitTime) / (flight - exitTime));
  const lead = clamp(baku.width * .09, 22, 56);
  const exit = { x: launch.x + direction.x * lead, y: launch.y + direction.y * lead };
  const tangent = lead * (flight - exitTime) / (3 * exitTime);
  const point = local < exitTime
    ? { x: launch.x + direction.x * lead * jet, y: launch.y + direction.y * lead * jet }
    : bezier(exit, { x: exit.x + direction.x * tangent, y: exit.y + direction.y * tangent },
      { x: target.x - 26, y: target.y - 100 }, target, fan);
  const settled = time >= durationFor(Math.max(0, readyAt));
  const settle = local >= flight && !settled ? Math.sin((local - flight) * 23) * Math.exp(-(local - flight) * 18) * -4 : 0;
  const scale = local < exitTime ? .055 + .165 * jet : .22 + .78 * (1 - (1 - fan) ** 2);
  const exitAngle = Math.atan2(-direction.y, -direction.x) * 180 / Math.PI;
  const rotation = fan >= 1 ? 0 : exitAngle * (1 - fan) + (index - (count - 1) / 2) * 7 * Math.sin(fan * Math.PI);
  return { x: point.x, y: point.y + settle, scale, rotation, opacity: readyAt < 0 ? 0 : clamp(local / .025),
    blankOpacity: readyAt < 0 ? 0 : clamp((local - flight) / .12) };
}
