import type { MobileKit } from '@inzpo/shared';
import type { PhotoInput } from './upload';

// Keep the picker image in memory across navigation, without putting a local
// file URI in route parameters. A new capture replaces the previous handoff.
let handoff: { id: string; photo: NonNullable<MobileKit['photo']> } | null = null;

export function handoffPhoto(id: string, photo: PhotoInput) {
  handoff = { id, photo: { url: photo.uri, width: photo.width, height: photo.height, placeholder: null } };
}

export function capturePhoto(id: string) {
  return handoff?.id === id ? handoff.photo : null;
}
