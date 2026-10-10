import type { MobileKit } from '@inzpo/shared';
import type { PhotoInput } from './upload';

// Keep the picker image in memory across navigation, without putting a local
// file URI in route parameters. A new capture replaces the previous handoff.
let handoff: { id: string; photo: NonNullable<MobileKit['photo']>; elapsed: number } | null = null;

export function handoffPhoto(id: string, photo: PhotoInput, elapsed = 0) {
  handoff = { id, photo: { url: photo.uri, width: photo.width, height: photo.height, placeholder: null }, elapsed };
}

export function captureElapsed(id: string) {
  return handoff?.id === id ? handoff.elapsed : 0;
}

export function capturePhoto(id: string) {
  return handoff?.id === id ? handoff.photo : null;
}
