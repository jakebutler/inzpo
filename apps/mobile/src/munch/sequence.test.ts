import fs from 'node:fs';
import path from 'node:path';
import { COLOR_ROLES } from '@inzpo/shared';
import { clipDuration, munchManifest } from './manifest';
import {
  advancePlayback, chipPosition, chipProgress, CHIP_COUNT, CHIP_STAGGER_MS,
  droppedFrames, hapticBetween, initialPlayback, LANDING_MS, sampleFrame,
} from './sequence';
import type { Playback } from './types';

const running = (): Playback => ({ ...initialPlayback(), stage: 'inhale' });
const root = path.resolve(__dirname, '../..');

test('manifest covers every frame once, has valid anchors, bounded pages and matching alpha WebP assets', () => {
  expect(munchManifest.kind).toBe('STAND-IN');
  expect(munchManifest.fps).toBe(60);
  expect(clipDuration('inhale')).toBe(800);
  expect(munchManifest.clips.chewLoop.count).toBe(munchManifest.clips.chewVariation.count);
  const indices = Object.values(munchManifest.clips).flatMap((clip) => Array.from({ length: clip.count }, (_, i) => clip.start + i));
  expect(indices).toEqual(munchManifest.frames.map((_, i) => i));
  for (const [name, events] of Object.entries(munchManifest.hapticFrames)) {
    const clip = munchManifest.clips[name as keyof typeof munchManifest.clips];
    for (const event of events) expect(event.frame).toBeLessThan(clip.count);
  }
  for (const frame of munchManifest.frames) {
    expect(frame.page).toBeLessThan(munchManifest.pageCount);
    expect(frame.rect.x % frame.rect.width).toBe(0);
    expect(frame.rect.y % frame.rect.height).toBe(0);
    for (const anchor of [frame.snoutAnchor, frame.bellyAnchor]) {
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.x).toBeLessThanOrEqual(frame.rect.width);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeLessThanOrEqual(frame.rect.height);
    }
  }
  // Lossless WebP uses VP8L; header records actual dimensions and alpha.
  for (const density of munchManifest.densities) {
    for (let page = 0; page < munchManifest.pageCount; page++) {
      const sizes = ['baku', 'stripes'].map((kind) => {
        const buffer = fs.readFileSync(path.join(root, `assets/munch/${kind}-${page}@${density}x.webp`));
        expect(buffer.subarray(8, 12).toString()).toBe('WEBP');
        const at = buffer.indexOf(Buffer.from('VP8L'));
        expect(at).toBeGreaterThan(0);
        const bits = buffer.readUInt32LE(at + 9);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >>> 14) & 0x3fff) + 1;
        expect((bits >>> 28) & 1).toBe(1);
        expect(width).toBeLessThanOrEqual(4096);
        expect(height).toBeLessThanOrEqual(4096);
        for (const frame of munchManifest.frames.filter((f) => f.page === page)) {
          expect((frame.rect.x + frame.rect.width) * density).toBeLessThanOrEqual(width);
          expect((frame.rect.y + frame.rect.height) * density).toBeLessThanOrEqual(height);
        }
        return [width, height];
      });
      expect(sizes[0]).toEqual(sizes[1]);
    }
  }
});

test('early extraction completes 800ms inhale and at least one chew before sneezing', () => {
  let state = advancePlayback(running(), 799, true);
  expect(state.stage).toBe('inhale');
  state = advancePlayback(state, 1, true);
  expect(state.stage).toBe('chew');
  expect(sampleFrame(state)).toMatchObject({ clip: 'chewLoop', localFrame: 0, cycle: 0 });
  state = advancePlayback(state, 399, true);
  expect(state.stage).toBe('chew');
  state = advancePlayback(state, 1, true);
  expect(state.stage).toBe('sneeze');
  expect(state.sneezeAt).toBe(1200);
});

test('pending extraction loops indefinitely and every third cycle varies', () => {
  for (let cycle = 0; cycle < 30; cycle++) {
    const state = advancePlayback(running(), 800 + cycle * 400, false);
    expect(state.stage).toBe('chew');
    expect(sampleFrame(state)).toMatchObject({ cycle, localFrame: 0, clip: (cycle + 1) % 3 === 0 ? 'chewVariation' : 'chewLoop' });
  }
});

test.each([1200, 1600, 2000])('resolution at the displayed chew boundary %sms finishes the new cycle', (elapsed) => {
  const previous = advancePlayback(running(), elapsed, false);
  expect(sampleFrame(previous).localFrame).toBe(0);
  const next = advancePlayback(previous, 1000 / 60, true);
  expect(next.stage).toBe('chew');
  expect(next.sneezeAt).toBe(elapsed + 400);
  expect(advancePlayback(next, elapsed + 400 - next.elapsed, true).stage).toBe('sneeze');
});

test('late extraction finishes the current variation cycle and lands within 1.2 seconds', () => {
  let state = advancePlayback(running(), 1700, false);
  expect(sampleFrame(state).clip).toBe('chewVariation');
  state = advancePlayback(state, 1, true);
  expect(state.sneezeAt).toBe(2000);
  state = advancePlayback(state, 298, true);
  expect(state.stage).toBe('chew');
  state = advancePlayback(state, 1, true);
  expect(state.stage).toBe('sneeze');
  state = advancePlayback(state, LANDING_MS - 1, true);
  expect(state.stage).toBe('sneeze');
  state = advancePlayback(state, 1, true);
  expect(state.stage).toBe('landed');
  expect(sampleFrame(state).frame).toBe(munchManifest.frames.length - 1);
  expect(LANDING_MS).toBeLessThanOrEqual(1200);
});

test.each([0, 500, 1700, 2100])('skip at %sms immediately lands without a pending promise', (elapsed) => {
  const state = advancePlayback(running(), elapsed, false);
  expect(advancePlayback(state, 0, false, true).stage).toBe('landed');
});

test('role-order chips use 75ms stagger, bounded overshoot, and exactly reach their slots', () => {
  expect(COLOR_ROLES.slice(0, CHIP_COUNT)).toEqual(['primary', 'secondary', 'accent', 'background', 'surface']);
  expect(CHIP_STAGGER_MS).toBeGreaterThanOrEqual(60);
  expect(CHIP_STAGGER_MS).toBeLessThanOrEqual(90);
  for (let index = 0; index < CHIP_COUNT; index++) {
    expect(chipProgress(50 + index * CHIP_STAGGER_MS, index)).toBe(0);
    expect(chipProgress(LANDING_MS, index)).toBe(1);
  }
  const start = { x: 0, y: 0 }, end = { x: 100, y: 0 };
  for (let n = 0; n <= 1000; n++) expect(chipPosition(start, end, n / 1000).x).toBeLessThanOrEqual(104);
  expect(chipPosition(start, end, 1)).toEqual(end);
});

test('haptics fire once on crossed frame, include cycle repeats, and coalesce missed buzzes', () => {
  const sample = (elapsed: number) => sampleFrame(advancePlayback(running(), elapsed, false));
  expect(hapticBetween(sample(200), sample(267))).toBe('light');
  expect(hapticBetween(sample(267), sample(280))).toBeNull();
  expect(hapticBetween(sample(10), sample(750))).toBe('heavy');
  expect(hapticBetween(sample(1150), sample(1310))).toBe('light');
  let state = advancePlayback(running(), 1200, true);
  const first = sampleFrame(state);
  state = advancePlayback(state, 51, true);
  expect(hapticBetween(first, sampleFrame(state))).toBe('rigid');
});

test('frame sampling survives hitches and counts missed 60Hz deadlines', () => {
  let state = running();
  for (let i = 0; i < 480; i++) state = advancePlayback(state, 1000 / 60, false);
  expect(sampleFrame(state).frame).toBeGreaterThanOrEqual(48);
  expect(sampleFrame(state).frame).toBeLessThan(96);
  expect(droppedFrames(16.67)).toBe(0);
  expect(droppedFrames(33.34)).toBe(1);
  expect(droppedFrames(100)).toBe(5);
});

test.each([[40, 20], [50, 10], [60, 0], [120, 0]])('continuous %ifps clock loses %i target frames over one second', (fps, expected) => {
  let elapsed = 0, drops = 0;
  for (let frame = 0; frame < fps; frame++) {
    const delta = 1000 / fps;
    drops += droppedFrames(delta, elapsed);
    elapsed += delta;
  }
  expect(drops).toBe(expected);
});

test('long hitches finish all transitions and landed playback stays terminal', () => {
  const landed = advancePlayback(running(), 5000, true);
  expect(landed.stage).toBe('landed');
  expect(advancePlayback(landed, 1000, false)).toBe(landed);
  expect(advancePlayback(running(), -100, false).elapsed).toBe(0);
});
