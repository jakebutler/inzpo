import sharp from "sharp";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import type { PlacementData } from "@/lib/boards";
import { textPathsSvg } from "@/lib/board-text";
import type { Rect } from "@/lib/board-arrange";

export type TileSpec =
  | { type: "image"; variantKey: string }
  | { type: "palette"; colors: string[] }
  | { type: "fallback"; title: string; host: string | null };

export interface RenderTile {
  rect: Rect;
  spec: TileSpec;
  /** Used to render an honest fallback tile when the image bytes can't be loaded. */
  fallback?: { title: string; host: string | null };
}

export interface LabelSpec {
  rect: Rect;
  text: string;
}

export interface RenderOptions {
  scale: number;
  labels?: LabelSpec[];
  format?: "png" | "webp";
  loadImage?: (key: string) => Promise<Buffer | null>;
}

export interface RenderResult {
  buffer: Buffer;
  /** True when at least one image tile couldn't be loaded — callers should not cache the output. */
  degraded: boolean;
}

const VARIANT_WIDTHS: Record<string, number> = { w1600: 1600, w640: 640, w256: 256 };

/** Smallest variant whose width covers targetW; largest available otherwise; null when no variants. */
export function chooseVariantKey(variants: Record<string, string> | null | undefined, targetW: number): string | null {
  if (!variants) return null;
  const candidates = Object.entries(variants)
    .filter(([name]) => name in VARIANT_WIDTHS)
    .sort((a, b) => VARIANT_WIDTHS[a[0]] - VARIANT_WIDTHS[b[0]]);
  if (candidates.length === 0) return null;
  const fit = candidates.find(([name]) => VARIANT_WIDTHS[name] >= targetW);
  return (fit ?? candidates[candidates.length - 1])[1];
}

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** A board tile renders the stored substance only: primary for image kinds, preview for linked, palette bands, fallback tile. */
export function tileForPlacement(p: PlacementData): TileSpec {
  const wantsImage = p.kind === "screenshot" || p.kind === "photo" || p.mediaRole === "preview";
  if (wantsImage) {
    const key = chooseVariantKey(p.variants, Math.min(p.w, 1600));
    if (key) return { type: "image", variantKey: key };
  }
  if (p.kind === "palette" && p.colors.length > 0) return { type: "palette", colors: p.colors };
  return { type: "fallback", title: p.title ?? "Untitled", host: hostOf(p.sourceUrl) };
}

export function isLightBackground(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

async function defaultLoadImage(key: string): Promise<Buffer | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  } catch {
    return null;
  }
}

function paletteSvg(colors: string[], w: number, h: number): string {
  const n = colors.length;
  const bands = colors
    .map((hex, i) => {
      const x0 = Math.round((i * w) / n);
      const x1 = Math.round(((i + 1) * w) / n);
      return `<rect x="${x0}" y="0" width="${Math.max(1, x1 - x0)}" height="${h}" fill="${hex}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bands}</svg>`;
}

async function fallbackSvg(spec: { title: string; host: string | null }, w: number, h: number, onLight: boolean): Promise<string> {
  const bg = onLight ? "#e4e4e7" : "#262626";
  const fg = onLight ? "#18181b" : "#e4e4e7";
  const muted = onLight ? "#52525b" : "#a1a1aa";
  const parts = [`<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`];
  if (w >= 72 && h >= 48) {
    const size = Math.max(11, Math.min(Math.round(w * 0.08), 28));
    const parts0 = await textPathsSvg([
      { text: spec.title, x: 12, y: Math.round(h * 0.42), size, fill: fg, maxWidth: w - 24 },
    ]);
    parts.push(parts0);
    if (spec.host) {
      parts.push(
        await textPathsSvg([
          { text: spec.host, x: 12, y: Math.round(h * 0.42) + Math.round(size * 1.4), size: Math.max(10, Math.round(size * 0.62)), fill: muted, maxWidth: w - 24 },
        ]),
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
}

async function labelsSvg(labels: LabelSpec[], scale: number, W: number, H: number): Promise<string> {
  const parts: string[] = [];
  const texts: Parameters<typeof textPathsSvg>[0] = [];
  for (const l of labels) {
    const barH = Math.max(14, Math.min(Math.round(l.rect.h * 0.22), Math.round(40 * scale)));
    const y = Math.round(l.rect.y * scale) + Math.round(l.rect.h * scale) - barH;
    const left = Math.round(l.rect.x * scale);
    const width = Math.round(l.rect.w * scale);
    parts.push(`<rect x="${left}" y="${y}" width="${width}" height="${barH}" fill="rgba(0,0,0,0.65)"/>`);
    const size = Math.max(10, Math.round(barH * 0.42));
    texts.push({
      text: l.text,
      x: left + Math.round(8 * scale) + 4,
      y: y + Math.round(barH / 2) + Math.round(size * 0.36),
      size,
      fill: "#ffffff",
      maxWidth: width - Math.round(16 * scale) - 8,
    });
  }
  parts.push(await textPathsSvg(texts));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

export async function renderBoardToBuffer(
  board: { canvasW: number; canvasH: number; background: string },
  tiles: RenderTile[],
  opts: RenderOptions,
): Promise<RenderResult> {
  const scale = opts.scale;
  const W = Math.max(1, Math.round(board.canvasW * scale));
  const H = Math.max(1, Math.round(board.canvasH * scale));
  const onLight = isLightBackground(board.background);
  const loadImage = opts.loadImage ?? defaultLoadImage;
  const composites: sharp.OverlayOptions[] = [];
  let degraded = false;

  for (const t of tiles) {
    const left = Math.round(t.rect.x * scale);
    const top = Math.round(t.rect.y * scale);
    const width = Math.round(t.rect.w * scale);
    const height = Math.round(t.rect.h * scale);
    if (left >= W || top >= H || width < 1 || height < 1) continue;
    const clipW = Math.min(width, W - left);
    const clipH = Math.min(height, H - top);
    if (t.spec.type === "image") {
      const buf = await loadImage(t.spec.variantKey);
      if (buf) {
        const img = await sharp(buf).resize(clipW, clipH, { fit: "cover" }).png().toBuffer();
        composites.push({ input: img, left, top });
      } else {
        degraded = true;
        if (t.fallback) {
          composites.push({ input: Buffer.from(await fallbackSvg(t.fallback, clipW, clipH, onLight)), left, top });
        }
      }
    } else if (t.spec.type === "palette") {
      composites.push({ input: Buffer.from(paletteSvg(t.spec.colors, clipW, clipH)), left, top });
    } else {
      composites.push({ input: Buffer.from(await fallbackSvg(t.spec, clipW, clipH, onLight)), left, top });
    }
  }

  if (opts.labels && opts.labels.length > 0) {
    composites.push({ input: Buffer.from(await labelsSvg(opts.labels, scale, W, H)), left: 0, top: 0 });
  }

  let pipeline = sharp({ create: { width: W, height: H, channels: 3, background: board.background } });
  if (composites.length > 0) pipeline = pipeline.composite(composites);
  const buffer =
    opts.format === "webp"
      ? await pipeline.webp({ quality: 90 }).toBuffer()
      : await pipeline.png({ compressionLevel: 9 }).toBuffer();
  return { buffer, degraded };
}

const MAX_EXPORT_SIDE = 4096;

export const EXPORT_SCALES = [1, 2] as const;
export const EXPORT_FORMATS = ["png", "webp"] as const;

export function exportDimensions(board: { canvasW: number; canvasH: number }, scale: number): { width: number; height: number } {
  return { width: Math.round(board.canvasW * scale), height: Math.round(board.canvasH * scale) };
}

export function validateExportParams(format: string | null, scale: string | null): { format: "png" | "webp"; scale: 1 | 2 } | null {
  const f = EXPORT_FORMATS.find((x) => x === format);
  const s = EXPORT_SCALES.find((x) => String(x) === scale);
  if (!f || s === undefined) return null;
  return { format: f, scale: s };
}

export function withinExportBounds(dims: { width: number; height: number }): boolean {
  return dims.width <= MAX_EXPORT_SIDE && dims.height <= MAX_EXPORT_SIDE;
}
