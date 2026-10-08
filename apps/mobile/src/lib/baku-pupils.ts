import type { SharedValue } from 'react-native-reanimated';
import type { BakuEye } from './baku-eyes';

export const PUPIL_FEATHER_PX = 0.75;
export const PUPIL_IMPULSE_PT = 2;
export type PupilVector = { x: number; y: number };
// Coordinates are fixed @3x sprite pixels, independent of display size/density.
export type PupilOffset = SharedValue<PupilVector>;
export type BakuJiggle = (impulse: PupilVector) => void;

export function clampPupilOffset(offset: PupilVector, pupilR: number, whiteR: number): PupilVector {
  'worklet';
  const maximum = Math.max(0, (whiteR - pupilR) * 0.8);
  const length = Math.hypot(offset.x, offset.y);
  const scale = length > maximum ? maximum / length : 1;
  return { x: offset.x * scale, y: offset.y * scale };
}

type RGB = readonly [number, number, number];
function smoothstep(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
function mix(a: RGB, b: RGB, amount: number): RGB {
  return a.map((value, channel) => value + (b[channel] - value) * amount) as unknown as RGB;
}

// JS reference of the SkSL eye pass. sampleBase returns straight RGB in sprite
// pixels. Zero offset is an exact identity, including the original felt texture.
export function pupilPixel(p: PupilVector, eye: BakuEye, offset: PupilVector, spritePixels: number,
  sampleBase: (point: PupilVector) => RGB): RGB {
  const original = sampleBase(p);
  const cx = eye.cx * spritePixels, cy = eye.cy * spritePixels;
  const pupilR = eye.pupilR * spritePixels, whiteR = eye.whiteR * spritePixels;
  const shift = clampPupilOffset(offset, pupilR, whiteR);
  const length = Math.hypot(shift.x, shift.y);
  if (length < 0.00001) return original;
  const distance = Math.hypot(p.x - cx, p.y - cy);
  const whiteMask = 1 - smoothstep(whiteR - PUPIL_FEATHER_PX, whiteR, distance);
  if (whiteMask <= 0) return original;
  const source = { x: p.x - shift.x, y: p.y - shift.y };
  const pupilMask = (d: number) => 1 - smoothstep(pupilR - PUPIL_FEATHER_PX, pupilR, d);
  const clean = mix(original, eye.whiteColor, pupilMask(distance));
  const moved = mix(clean, sampleBase(source), pupilMask(Math.hypot(source.x - cx, source.y - cy)));
  return mix(original, moved, whiteMask * smoothstep(0, PUPIL_FEATHER_PX, length));
}
