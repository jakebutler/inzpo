import sharp from "sharp";
import { rgbToHex } from "@/lib/colors";

export interface ExtractedColor {
  hex: string;
  origin: "extracted" | "dominant";
}

const VIBRANT_KEYS = [
  "Vibrant",
  "DarkVibrant",
  "LightVibrant",
  "Muted",
  "DarkMuted",
  "LightMuted",
] as const;

export async function extractColors(input: Buffer): Promise<ExtractedColor[]> {
  const out: ExtractedColor[] = [];
  const seen = new Set<string>();

  try {
    const { Vibrant } = await import("node-vibrant/node");
    const downscaled = await sharp(input).rotate().resize({ width: 256, height: 256, fit: "inside" }).toBuffer();
    const vibrant = new Vibrant(downscaled, {});
    const palette = await vibrant.getPalette();
    for (const key of VIBRANT_KEYS) {
      const swatch = palette[key];
      if (!swatch) continue;
      const hex = rgbToHex(swatch.rgb[0], swatch.rgb[1], swatch.rgb[2]);
      if (!seen.has(hex)) {
        seen.add(hex);
        out.push({ hex, origin: "extracted" });
      }
    }
  } catch {
    // vibrancy unavailable — the dominant fallback below still guarantees one searchable color
  }

  const stats = await sharp(input).stats();
  const dominantHex = rgbToHex(stats.dominant.r, stats.dominant.g, stats.dominant.b);
  if (!seen.has(dominantHex)) {
    seen.add(dominantHex);
    out.push({ hex: dominantHex, origin: "dominant" });
  }

  return out;
}
