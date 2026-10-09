import { clipDuration, munchManifest } from './manifest';
import type { FrameSample, Playback, Point } from './types';

export const CHIP_STAGGER_MS = 75;
export const CHIP_FLIGHT_MS = 850;
export const CHIP_COUNT = 5;
export const SNEEZE_EMIT_MS = 50;
export const LANDING_MS = SNEEZE_EMIT_MS + CHIP_FLIGHT_MS + CHIP_STAGGER_MS * (CHIP_COUNT - 1);
export const initialPlayback = (): Playback => ({ stage: 'idle', elapsed: 0, sneezeAt: -1 });

/** Absolute elapsed time avoids accumulating fractional frame rounding errors. */
export function advancePlayback(previous: Playback, delta: number, resolved: boolean, skip = false): Playback {
  'worklet';
  if (skip) return { ...previous, stage: 'landed' };
  if (previous.stage === 'idle' || previous.stage === 'landed') return previous;
  const elapsed = previous.elapsed + Math.max(0, delta);
  const inhale = clipDuration('inhale');
  const chew = clipDuration('chewLoop');
  let sneezeAt = previous.sneezeAt;
  // An early result still completes inhale and one chew. A later result finishes
  // the current chew cycle; every third cycle uses the variation clip.
  if (resolved && sneezeAt < 0) {
    sneezeAt = inhale + Math.max(1, Math.floor(Math.max(0, previous.elapsed - inhale) / chew) + 1) * chew;
  }
  const stage = sneezeAt >= 0 && elapsed >= sneezeAt + LANDING_MS ? 'landed'
    : sneezeAt >= 0 && elapsed >= sneezeAt ? 'sneeze'
      : elapsed < inhale ? 'inhale' : 'chew';
  return { stage, elapsed, sneezeAt };
}

export function sampleFrame(playback: Playback): FrameSample {
  'worklet';
  let clip: FrameSample['clip'] = 'inhale';
  let time = 0;
  let cycle = 0;
  if (playback.stage === 'inhale') time = playback.elapsed;
  if (playback.stage === 'chew') {
    const chewElapsed = Math.max(0, playback.elapsed - clipDuration('inhale'));
    cycle = Math.floor(chewElapsed / clipDuration('chewLoop'));
    clip = (cycle + 1) % 3 === 0 ? 'chewVariation' : 'chewLoop';
    time = chewElapsed % clipDuration(clip);
  }
  if (playback.stage === 'sneeze' || playback.stage === 'landed') {
    clip = 'sneeze';
    time = playback.stage === 'landed' ? clipDuration(clip) : playback.elapsed - playback.sneezeAt;
  }
  const definition = munchManifest.clips[clip];
  const localFrame = Math.min(definition.count - 1, Math.max(0, Math.floor(time * munchManifest.fps / 1000)));
  return { clip, frame: definition.start + localFrame, localFrame, cycle };
}

/** At most one haptic per displayed frame; stale events after a hitch are dropped. */
export function hapticBetween(previous: FrameSample, next: FrameSample) {
  'worklet';
  const sameCycle = previous.clip === next.clip && previous.cycle === next.cycle;
  const start = sameCycle ? previous.localFrame : -1;
  let kind = null;
  for (const event of munchManifest.hapticFrames[next.clip]) {
    if (event.frame > start && event.frame <= next.localFrame) kind = event.kind;
  }
  return kind;
}

export function chipProgress(sneezeElapsed: number, index: number): number {
  'worklet';
  return Math.max(0, Math.min(1, (sneezeElapsed - SNEEZE_EMIT_MS - index * CHIP_STAGGER_MS) / CHIP_FLIGHT_MS));
}
export function chipPosition(from: Point, to: Point, progress: number): Point {
  'worklet';
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return from;
  if (p === 1) return to;
  // Travels to 103% at 80%, then settles. Bounded 3% overshoot, no spring tail.
  const travel = p < .8 ? 1.03 * (1 - Math.pow(1 - p / .8, 3)) : 1 + .03 * Math.pow((1 - p) / .2, 2);
  return { x: from.x + (to.x - from.x) * travel,
    y: from.y + (to.y - from.y) * travel - 72 * Math.sin(Math.PI * p) };
}
export function droppedFrames(delta: number, elapsed = 0): number {
  'worklet';
  // Count crossed 60Hz slots on the continuous clock. Rounding each interval
  // independently overcounts 40fps and misses sustained 50fps entirely.
  const slot = (time: number) => Math.floor(time * 60 / 1000 + 1e-6);
  return Math.max(0, slot(elapsed + Math.max(0, delta)) - slot(elapsed) - 1);
}
