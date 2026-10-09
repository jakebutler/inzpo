import data from './standin-manifest.json';
import type { ClipName, MunchManifest } from './types';

// Plain JSON data: replace generated stand-ins with final renders using this contract.
export const munchManifest = data as MunchManifest;
export function clipDuration(name: ClipName): number {
  'worklet';
  return munchManifest.clips[name].count * 1000 / munchManifest.fps;
}
