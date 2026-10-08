import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { MEDIA_VARIANTS, variantKey, type MediaVariant } from "@/lib/r2";
import { decodeHeicToPng, isHeicBuffer } from "@/lib/heic";

const SUPPORTED = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff"]);

// decompression-bomb caps (review M3): 40 MP pixel budget, 12000 px per side
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_INPUT_DIMENSION = 12_000;
/** Stored original is this long edge, not the phone's full-resolution file. */
export const MAX_STORE_EDGE = 2000;

export function exceedsPixelBudget(width: number, height: number): boolean {
  return width * height > MAX_INPUT_PIXELS || width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION;
}

export interface ProcessedImage {
  width: number;
  height: number;
  mime: string;
  ext: string;
  original: Buffer;
  sha256: string;
  bytes: number;
  variants: Record<MediaVariant, { key: string; buffer: Buffer; width: number; height: number }>;
  placeholder: string;
}

async function rasterForStore(input: Buffer): Promise<Buffer> {
  const decoded = isHeicBuffer(input) ? await decodeHeicToPng(input) : input;
  const meta = await sharp(decoded, { failOn: "error" }).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Unsupported media: format=${meta.format}`);
  }
  if (!isHeicBuffer(input) && (!meta.format || !SUPPORTED.has(meta.format))) {
    throw new Error(`Unsupported media: format=${meta.format}`);
  }
  if (exceedsPixelBudget(meta.width, meta.height)) {
    throw new Error(
      `Image too large: ${meta.width}x${meta.height} (max ${MAX_INPUT_PIXELS / 1_000_000}MP, ${MAX_INPUT_DIMENSION}px per side)`,
    );
  }
  // Apply an embedded Display P3 (or other) ICC profile by converting to sRGB,
  // then store the ~2000px copy rather than the original.
  return sharp(decoded, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .toColourspace("srgb")
    .resize({
      width: MAX_STORE_EDGE,
      height: MAX_STORE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export async function processImage(input: Buffer, itemId: string): Promise<ProcessedImage> {
  const original = await rasterForStore(input);
  const meta = await sharp(original, { failOn: "error" }).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Processed image has no dimensions");
  }

  const variants = {} as ProcessedImage["variants"];
  const [variantRows, placeholderBuffer] = await Promise.all([
    Promise.all(
      MEDIA_VARIANTS.map(async (v) => {
        const width = parseInt(v.slice(1), 10);
        const { data, info } = await sharp(original, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
        return [v, { key: variantKey(itemId, v), buffer: data, width: info.width, height: info.height }] as const;
      }),
    ),
    sharp(original, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .resize({ width: 24, withoutEnlargement: true })
      .webp({ quality: 40 })
      .toBuffer(),
  ]);
  for (const [name, variant] of variantRows) {
    variants[name] = variant;
  }
  const placeholder = `data:image/webp;base64,${placeholderBuffer.toString("base64")}`;
  const sha256 = createHash("sha256").update(original).digest("hex");

  return {
    width: meta.width,
    height: meta.height,
    mime: "image/jpeg",
    ext: "jpg",
    original,
    sha256,
    bytes: original.byteLength,
    variants,
    placeholder,
  };
}

export function looksLikeScreenshot(filename: string | null | undefined): boolean {
  return !!filename && /screenshot/i.test(filename);
}

export function deriveTitleFromFilename(filename: string | null | undefined): string {
  if (!filename) return "Untitled";
  const base = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  return base.length > 0 ? base : "Untitled";
}
