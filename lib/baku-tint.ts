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

/**
 * Isolate the ground-shadow slice and multiply it by the band hex.
 * CSS mix-blend-mode does not survive WebKit/Chromium screenshots, so bake it.
 */
export function multiplyShadowPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  groundHex: string,
  clipPct: number,
): void {
  if (width < 1 || height < 1 || channels < 3) return;
  if (!isHexColor(groundHex)) return;
  const cut = Math.floor((height * (100 - clipPct)) / 100);
  const { r, g, b } = hexToRgb(groundHex);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (y < cut) {
        if (channels > 3) pixels[i + 3] = 0;
        continue;
      }
      pixels[i] = multiplyChannel(pixels[i] ?? 0, r);
      pixels[i + 1] = multiplyChannel(pixels[i + 1] ?? 0, g);
      pixels[i + 2] = multiplyChannel(pixels[i + 2] ?? 0, b);
    }
  }
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
