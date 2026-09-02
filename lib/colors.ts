export const COLOR_FAMILIES = [
  "red",
  "orange",
  "yellow",
  "cream/beige",
  "brown",
  "gold",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "black",
  "white",
  "gray",
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
  chroma: number;
  sHsv: number;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l, chroma: 0, sHsv: 0 };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const sHsv = d / max;
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l, chroma: d, sHsv };
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hexToFamily(hex: string): ColorFamily {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l, chroma, sHsv } = rgbToHsl(r, g, b);

  if (l < 0.09) return "black";
  if (chroma === 0 || (s < 0.1 && sHsv < 0.1)) {
    if (l > 0.92) return "white";
    return "gray";
  }
  if (l >= 0.65 && sHsv < 0.35 && h >= 30 && h <= 80) return "cream/beige";
  if (l < 0.35 && h >= 10 && h <= 55) return "brown";

  if (h < 10 || h >= 352) return "red";
  if (h < 42) return "orange";
  if (h < 55) return s >= 0.45 ? "gold" : "yellow";
  if (h < 68) return "yellow";
  if (h < 160) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  if (h < 310) return l < 0.4 ? "purple" : "pink";
  return "pink";
}

export function isHexColor(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHex(value: string): string {
  const clean = value.trim().replace("#", "").toLowerCase();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return `#${full}`;
}
