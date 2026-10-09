import { chewFrame, CYCLE_MS, FRAME_COUNT, FPS } from './sequence';

test('chews indefinitely, with the spike variation on every third cycle', () => {
  expect(chewFrame(0)).toBe(0);
  expect(chewFrame(CYCLE_MS - 1)).toBe(23);
  expect(chewFrame(CYCLE_MS)).toBe(0);
  expect(chewFrame(CYCLE_MS * 2)).toBe(24);
  expect(chewFrame(CYCLE_MS * 3 - 1)).toBe(47);
  expect(chewFrame(CYCLE_MS * 3)).toBe(0);
  for (let elapsed = 0; elapsed < 60000; elapsed += 1000 / FPS) {
    expect(chewFrame(elapsed)).toBeGreaterThanOrEqual(0);
    expect(chewFrame(elapsed)).toBeLessThan(FRAME_COUNT);
  }
});
