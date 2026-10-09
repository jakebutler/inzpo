import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { extractPalette } from "@/lib/palette-extract";
import { REGION_ORIGIN } from "@/lib/derived-roles";

export type FoldPhoto = "IMG_6505" | "IMG_6208" | "IMG_5859";

export type FoldColor = {
  hex: string;
  role: ColorRole;
  position: number;
  pinX: number;
  pinY: number;
  origin: typeof REGION_ORIGIN;
};

export type FoldKit = {
  title: string;
  imageSrc: string;
  width: number;
  height: number;
  colors: FoldColor[];
};

export async function loadFoldKit(which: FoldPhoto = "IMG_6505"): Promise<FoldKit> {
  const imageSrc = `/sample/${which}.jpg`;
  const file = path.join(process.cwd(), "public/sample", `${which}.jpg`);
  try {
    const buffer = await readFile(file);
    const meta = await sharp(buffer).metadata();
    const palette = await extractPalette(buffer);
    const colors: FoldColor[] = [];
    COLOR_ROLES.forEach((role, position) => {
      const hex = palette.roles[role];
      if (!hex) return;
      const swatch =
        palette.swatches.find((row) => row.role === role) ??
        palette.swatches.find((row) => row.hex.toLowerCase() === hex.toLowerCase());
      if (!swatch) return;
      colors.push({
        hex,
        role,
        position,
        pinX: swatch.pinX,
        pinY: swatch.pinY,
        origin: REGION_ORIGIN,
      });
    });
    return {
      title: which === "IMG_6505" ? "Yellow Victorian" : which === "IMG_6208" ? "Blue storefront" : "Red mural",
      imageSrc,
      width: meta.width ?? 1500,
      height: meta.height ?? 2000,
      colors,
    };
  } catch {
    return {
      title: which === "IMG_6505" ? "Yellow Victorian" : which === "IMG_6208" ? "Blue storefront" : "Red mural",
      imageSrc,
      width: 1500,
      height: 2000,
      colors: [],
    };
  }
}

export function dropRoles(colors: FoldColor[], roles: ColorRole[]): FoldColor[] {
  return colors.filter((color) => !roles.includes(color.role));
}
