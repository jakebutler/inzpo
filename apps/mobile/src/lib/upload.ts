import { type InzpoClient } from '@inzpo/shared';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

export type PhotoInput = { uri: string; width: number; height: number; fileName?: string | null };
const MAX_LONG_EDGE = 2048;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function uploadPhoto(client: InzpoClient, photo: PhotoInput): Promise<string> {
  if (![photo.width, photo.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid photo dimensions');
  }
  const context = ImageManipulator.manipulate(photo.uri);
  let rendered: ImageRef | undefined;
  try {
    if (Math.max(photo.width, photo.height) > MAX_LONG_EDGE) {
      context.resize(photo.width >= photo.height ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE });
    }
    rendered = await context.renderAsync();
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    const response = await fetch(image.uri);
    if (!response.ok) throw new Error('Could not read photo');
    const body = await response.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) throw new Error('Invalid photo size');
    const presign = await client.presignUpload({ contentType: 'image/jpeg', bytes: body.byteLength });
    await client.uploadToPresignedUrl(presign, body);
    const filename = `${(photo.fileName || 'house').replace(/\.[^.]*$/, '')}.jpg`;
    const { itemId } = await client.createKit({ uploadKey: presign.key, filename });
    return itemId;
  } finally {
    rendered?.release();
    context.release();
  }
}
