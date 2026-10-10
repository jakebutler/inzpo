// From cursor/inzpo-munch-spike's sampleFrame: 24-frame chews at 60fps,
// with the full-cheek variation on every third cycle. Rendered from the clean cutout at each display density.
export const FRAME_WIDTH = 176;
export const FRAME_HEIGHT = 144;
export const FRAME_COUNT = 48;
export const COLUMNS = 6;
export const FPS = 60;
export const CYCLE_MS = 24 * 1000 / FPS;

export function chewFrame(elapsed: number) {
  'worklet';
  const time = Math.max(0, elapsed);
  const cycle = Math.floor(time / CYCLE_MS);
  return ((cycle + 1) % 3 === 0 ? 24 : 0) + Math.min(23, Math.floor((time % CYCLE_MS) * FPS / 1000));
}
