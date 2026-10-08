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
/**
 * Replace pale fringe on semi-transparent edges with the nearest opaque body's RGB.
 * Cheap premultiply-edge fix for cream halos over navy bands.
 */
export function defringePremulEdges(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  opaqueMin = 250,
  fringeMax = 220,
): void {
  if (width < 1 || height < 1 || channels < 4) return;
  const copy = new Uint8ClampedArray(pixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = copy[i + 3] ?? 0;
      if (a === 0 || a >= opaqueMin || a > fringeMax) continue;
      let found = false;
      for (let oy = -1; oy <= 1 && !found; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width + nx) * channels;
          if ((copy[ni + 3] ?? 0) < opaqueMin) continue;
          pixels[i] = copy[ni] ?? 0;
          pixels[i + 1] = copy[ni + 1] ?? 0;
          pixels[i + 2] = copy[ni + 2] ?? 0;
          found = true;
          break;
        }
      }
      if (!found) {
        const scale = a / 255;
        pixels[i] = Math.round((pixels[i] ?? 0) * scale);
        pixels[i + 1] = Math.round((pixels[i + 1] ?? 0) * scale);
        pixels[i + 2] = Math.round((pixels[i + 2] ?? 0) * scale);
      }
    }
  }
}

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
