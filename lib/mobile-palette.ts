import 'server-only';
import type { ItemDetail } from '@/lib/items';
import { extractPalette, type ExtractedPalette } from '@/lib/palette-extract';
import { r2, GetObjectCommand } from '@/lib/r2';

const refreshed = new Map<string, Promise<ExtractedPalette>>();

/** Read old palettes through the current extractor; explicit samples win.
 * Cache photo extraction only, so a concurrent user edit is never written over.
 */
export async function upgradeMobilePalette(item: ItemDetail): Promise<ItemDetail> {
  const automatic = item.colors.filter((color) => color.origin !== 'sampled');
  // Old manual hex edits have no pin. Leave those kits alone rather than
  // guessing whether an absent role or coordinate was a user decision.
  const legacy = item.colors.length === 6 && automatic.length > 0 && automatic.every((color) => color.origin === 'extracted' &&
    color.pinX != null && color.pinY != null);
  const needsPins = automatic.some((color) => color.origin === 'region');
  if (!item.media || (!legacy && !needsPins)) return item;
  const key = `${process.env.R2_BUCKET}:${item.media.originalKey}`;
  let pending = refreshed.get(key);
  if (!pending) {
    const originalKey = item.media.originalKey;
    pending = (async () => {
      const object = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: originalKey }));
      if (!object.Body) throw new Error('Kit photo unavailable for palette refresh');
      return extractPalette(Buffer.from(await object.Body.transformToByteArray()));
    })();
    if (refreshed.size >= 32) refreshed.delete(refreshed.keys().next().value!);
    refreshed.set(key, pending);
    pending.catch(() => { if (refreshed.get(key) === pending) refreshed.delete(key); });
  }
  const palette = await pending;
  if (!legacy) {
    // Reanchor older region centroids without filling user-cleared roles or
    // changing a sampled color. The painted hex and role remain unchanged.
    return { ...item, colors: item.colors.map((color) => {
      if (color.origin !== 'region') return color;
      const match = palette.swatches.find((swatch) => swatch.role === color.role && swatch.hex.toLowerCase() === color.hex.toLowerCase());
      return match ? { ...color, pinX: match.pinX, pinY: match.pinY } : color;
    }) };
  }
  const colors: ItemDetail['colors'] = palette.swatches.map((swatch, position) => ({
    hex: swatch.hex, role: swatch.role, name: swatch.name, family: swatch.family,
    origin: swatch.origin, position, pinX: swatch.pinX, pinY: swatch.pinY,
  }));
  for (const sampled of item.colors.filter((color) => color.origin === 'sampled')) {
    const index = colors.findIndex((color) => color.role === sampled.role);
    if (index >= 0) colors.splice(index, 1);
    colors.push(sampled);
  }
  return { ...item, colors };
}
