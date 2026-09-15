// Text → SVG vector paths via opentype.js, using a bundled Inter (OFL).
// Glyph paths (not @font-face) keep rendering deterministic on fontless runtimes.
// Shaping is intentionally naive (per-char advance, no kerning/ligatures) — captions don't need it,
// and it bypasses opentype.js's unsupported GSUB paths in variable fonts.

export interface TextSpec {
  text: string;
  x: number;
  y: number; // baseline
  size: number;
  fill: string;
  maxWidth?: number;
}

interface Glyph {
  advanceWidth: number;
  getPath: (x: number, y: number, fontSize: number) => { toPathData: (d?: number) => string };
}

interface ParsedFont {
  unitsPerEm: number;
  charToGlyph: (char: string) => Glyph;
}

let fontPromise: Promise<ParsedFont> | null = null;

async function loadFont(): Promise<ParsedFont> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const mod = (await import("opentype.js")) as unknown as Record<string, unknown>;
      const root = (mod.parse ? mod : ((mod.default ?? {}) as Record<string, unknown>)) as {
        parse: (buffer: ArrayBuffer) => ParsedFont;
      };
      const { default: b64 } = (await import("@/lib/assets/inter-regular-base64")) as { default: string };
      const buf = Buffer.from(b64, "base64");
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return root.parse(ab);
    })();
    fontPromise.catch(() => {
      fontPromise = null;
    });
  }
  return fontPromise;
}

function measure(font: ParsedFont, text: string, size: number): number {
  const scale = size / font.unitsPerEm;
  let total = 0;
  for (const ch of text) total += font.charToGlyph(ch).advanceWidth * scale;
  return total;
}

function shapeText(font: ParsedFont, text: string, x: number, y: number, size: number): string {
  const scale = size / font.unitsPerEm;
  let cursor = x;
  let d = "";
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    d += glyph.getPath(cursor, y, size).toPathData(2);
    cursor += glyph.advanceWidth * scale;
  }
  return d;
}

function fitText(font: ParsedFont, text: string, size: number, maxWidth?: number): string {
  if (!maxWidth || measure(font, text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measure(font, `${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return t === text ? text : `${t}…`;
}

export async function textPathsSvg(specs: TextSpec[]): Promise<string> {
  if (specs.length === 0) return "";
  const font = await loadFont();
  const fill = specs[0].fill;
  const paths = specs
    .map((s) => {
      const d = shapeText(font, fitText(font, s.text, s.size, s.maxWidth), s.x, s.y, s.size);
      return d ? `<path d="${d}"/>` : "";
    })
    .join("");
  return `<g fill="${fill}">${paths}</g>`;
}

export async function textWidth(text: string, size: number): Promise<number> {
  const font = await loadFont();
  return measure(font, text, size);
}
