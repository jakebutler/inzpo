import { anticipationAt, clamp, deform, durationFor, performancePoseAt, SNOUT, TIMING } from './motion';
import type { Emitter, Point } from './transport';

export const HOST_FLIGHT = { delay: .31, duration: 1.75 };

export function hostDurationFor(readyAt: number) {
  'worklet';
  return Math.max(durationFor(readyAt), anticipationAt(readyAt) + TIMING.anticipation + HOST_FLIGHT.delay + HOST_FLIGHT.duration);
}

/** Fixed per capture: playful variation without jitter from new random values each frame. */
export function flightSeed(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (hash >>> 0) % 997 / 997;
}

/** Center coordinates plus scale; the resting endpoint is the same rendered mesh. */
export function balloonFlight(time: number, readyAt: number, origin: Emitter, target: Emitter,
  seed: number, bounds: { width: number; height: number }) {
  'worklet';
  const start = readyAt < 0 ? Infinity : anticipationAt(readyAt) + TIMING.anticipation + HOST_FLIGHT.delay;
  const p = clamp((time - start) / HOST_FLIGHT.duration);
  const a = { x: origin.x + origin.width / 2, y: origin.y + origin.width / 3 };
  const b = { x: target.x + target.width / 2, y: target.y + target.width / 3 };
  if (p === 0) return { ...a, scale: 1, rotation: 0 };
  if (p === 1) return { ...b, scale: target.width / origin.width, rotation: 0 };
  const envelope = Math.sin(p * Math.PI);
  const phase = seed * Math.PI * 2;
  const progress = p * p * (3 - 2 * p);
  const deflate = 1 - (1 - p) ** 2;
  const scale = 1 + (target.width / origin.width - 1) * deflate;
  const radius = origin.width * scale * .43;
  const x = a.x + (b.x - a.x) * progress + envelope * bounds.width * .19 * Math.sin(p * Math.PI * 5 + phase);
  const y = a.y + (b.y - a.y) * progress - envelope * bounds.height * (.17 + .08 * Math.sin(p * Math.PI * 4 + phase));
  return { x: clamp(x, radius, bounds.width - radius), y: clamp(y, radius, bounds.height - radius), scale,
    rotation: envelope * (54 * Math.sin(p * Math.PI * 5 + phase) - 24) };
}

/** Warm paper dust funnels into the actual moving nostril, never a fake palette. */
export function intakeDust(time: number, blend: number, index: number, source: Point, baku: Emitter,
  elapsed: number, readyAt: number) {
  'worklet';
  const progress = (time / 1.35 + index * .137) % 1;
  const tip = deform(SNOUT.x, SNOUT.y, performancePoseAt(elapsed, readyAt < 0 ? null : readyAt, time, blend));
  const end = { x: baku.x + tip.x * baku.width, y: baku.y + tip.y * baku.width * 2 / 3 };
  const spread = Math.sin(index * 2.4) * 24;
  const curve = Math.sin(progress * Math.PI);
  return { x: source.x + (end.x - source.x) * progress + curve * spread,
    y: source.y + (end.y - source.y) * progress - curve * (18 + index % 4 * 6),
    radius: (index % 3 === 0 ? 10 : 4) * (1 - progress * .8),
    opacity: Math.sin(progress * Math.PI) * .48 * blend * clamp(time / .3) };
}
