import { COLOR_ROLES } from "@/lib/db/schema";
import { hexToRgb, isHexColor } from "@/lib/colors";
import { BAKU_BAND_GRAYS } from "@/lib/baku-v6";
import type { MascotKit } from "@/lib/mascot";

export function grayToBandIndex(gray: number): number | null {
  if (!Number.isFinite(gray)) return null;
  const i = (BAKU_BAND_GRAYS as readonly number[]).indexOf(gray);
  return i >= 0 ? i : null;
}

export function multiplyChannel(sprite: number, ink: number): number {
  return Math.round((sprite * ink) / 255);
}

/** Multiply the grayscale knit pixel by a kit hex. */
export function multiplyGrayByHex(spriteR: number, spriteG: number, spriteB: number, hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  return [multiplyChannel(spriteR, r), multiplyChannel(spriteG, g), multiplyChannel(spriteB, b)];
}

export function tintRoles(kit: MascotKit, revealedCount: number | null): Array<string | null> {
  return COLOR_ROLES.map((role, i) => {
    if (revealedCount != null && i >= revealedCount) return null;
    const hex = kit[role];
    if (!hex || !isHexColor(hex)) return null;
    return hex;
  });
}

function readGray(data: Uint8ClampedArray, i: number, channels: number): number {
  if (channels >= 3) return data[i] ?? 0;
  return data[i] ?? 0;
}

/** Tint sprite pixels in place using a same-size grayscale index mask. */
export function tintSpriteWithBands(
  sprite: Uint8ClampedArray,
  bands: Uint8ClampedArray,
  width: number,
  height: number,
  spriteChannels: number,
  bandChannels: number,
  colors: Array<string | null>,
): void {
  const pixels = width * height;
  for (let p = 0; p < pixels; p++) {
    const si = p * spriteChannels;
    const bi = p * bandChannels;
    const gray = readGray(bands, bi, bandChannels);
    const index = grayToBandIndex(gray);
    if (index == null) continue;
    const hex = colors[index];
    if (!hex) continue;
    const sr = sprite[si] ?? 0;
    const sg = sprite[si + 1] ?? 0;
    const sb = sprite[si + 2] ?? 0;
    const [r, g, b] = multiplyGrayByHex(sr, sg, sb, hex);
    sprite[si] = r;
    if (spriteChannels > 1) sprite[si + 1] = g;
    if (spriteChannels > 2) sprite[si + 2] = b;
  }
}
