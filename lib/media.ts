import sharp from "sharp";
import { createHash } from "node:crypto";
import { MEDIA_VARIANTS, variantKey, type MediaVariant } from "@/lib/r2";

const SUPPORTED = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff"]);
const EXT: Record<string, string> = { jpeg: "jpg" };

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

export async function processImage(input: Buffer, itemId: string): Promise<ProcessedImage> {
  const meta = await sharp(input, { failOn: "error" }).metadata();
  if (!meta.width || !meta.height || !meta.format || !SUPPORTED.has(meta.format)) {
    throw new Error(`Unsupported media: format=${meta.format}`);
  }
  const ext = EXT[meta.format] ?? meta.format;
  const mime = `image/${meta.format === "jpeg" ? "jpeg" : meta.format}`;
  const sha256 = createHash("sha256").update(input).digest("hex");

  const variants = {} as ProcessedImage["variants"];
  for (const v of MEDIA_VARIANTS) {
    const width = parseInt(v.slice(1), 10);
    const pipeline = sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    variants[v] = { key: variantKey(itemId, v), buffer: data, width: info.width, height: info.height };
  }

  const placeholderBuffer = await sharp(input)
    .rotate()
    .resize({ width: 24, withoutEnlargement: true })
    .webp({ quality: 40 })
    .toBuffer();
  const placeholder = `data:image/webp;base64,${placeholderBuffer.toString("base64")}`;

  return {
    width: meta.width,
    height: meta.height,
    mime,
    ext,
    original: input,
    sha256,
    bytes: input.byteLength,
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
