import { BAKU_SPRITE_PIXELS, bakuEyes } from './baku-eyes';
import { clampPupilOffset, pupilPixel } from './baku-pupils';

const pixels = BAKU_SPRITE_PIXELS;
test('closed success and error eyes are never animated', () => {
  expect(bakuEyes.success).toEqual([]);
  expect(bakuEyes.errorBrief).toEqual([]);
  expect(bakuEyes.errorPhoto).toEqual([]);
});
test.each([['idle', 54.6, 93.2], ['chewing', 63.2, 93.1]] as const)('%s has the verified big pupil', (pose, cx, cy) => {
  const eye = bakuEyes[pose][0];
  expect(Math.abs(eye.cx * pixels - cx)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(eye.cy * pixels - cy)).toBeLessThanOrEqual(1.5);
});
test('geometry and colors are normalized, with room to move and at most two eyes', () => {
  Object.values(bakuEyes).forEach((eyes) => {
    expect(eyes.length).toBeLessThanOrEqual(2);
    eyes.forEach((eye) => {
      [eye.cx, eye.cy, eye.pupilR, eye.whiteR, ...eye.whiteColor].forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
      });
      expect(eye.pupilR).toBeLessThan(eye.whiteR);
    });
  });
});
test('arbitrary offsets keep the entire pupil inside the white disc', () => {
  Object.values(bakuEyes).flat().forEach((eye) => {
    const pupilR = eye.pupilR * pixels, whiteR = eye.whiteR * pixels;
    [{ x: 0, y: 0 }, { x: 300, y: -400 }, { x: -1, y: 2 }].forEach((impulse) => {
      const shift = clampPupilOffset(impulse, pupilR, whiteR);
      expect(Math.hypot(shift.x, shift.y) + pupilR).toBeLessThanOrEqual(whiteR);
      expect(Math.hypot(shift.x, shift.y)).toBeLessThanOrEqual((whiteR - pupilR) * 0.8 + 1e-8);
    });
  });
});
test('zero offset reproduces every base pixel exactly; outside the white is untouched', () => {
  const sample = ({ x, y }: { x: number; y: number }) => [x / pixels, y / pixels, (x + y) / (2 * pixels)] as const;
  const eye = bakuEyes.idle[0];
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
    expect(pupilPixel({ x, y }, eye, { x: 0, y: 0 }, pixels, sample)).toEqual(sample({ x, y }));
  }
  const outside = { x: eye.cx * pixels + eye.whiteR * pixels + 0.1, y: eye.cy * pixels };
  expect(pupilPixel(outside, eye, { x: 100, y: 50 }, pixels, sample)).toEqual(sample(outside));
});
