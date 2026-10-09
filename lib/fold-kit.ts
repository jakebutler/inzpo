import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { extractPalette } from "@/lib/palette-extract";
import { HANDOFF_KITS, type MascotKit } from "@/lib/mascot";
import { markDerivedRoles } from "@/lib/derived-roles";

export type FoldPhoto = "IMG_6505" | "IMG_6208" | "IMG_5859";

export type FoldColor = {
  hex: string;
  role: ColorRole;
  position: number;
  pinX: number;
  pinY: number;
  derivedFrom: ColorRole | null;
};

export type FoldKit = {
  title: string;
  imageSrc: string;
  width: number;
  height: number;
  colors: FoldColor[];
};

function colorsFromKit(kit: MascotKit): FoldColor[] {
  const rows = COLOR_ROLES.flatMap((role, position) => {
    const hex = kit[role];
    if (!hex) return [];
    return [
      {
        hex,
        role,
        position,
        pinX: 0.18 + (position % 3) * 0.28,
        pinY: 0.22 + Math.floor(position / 3) * 0.38,
      },
    ];
  });
  return markDerivedRoles(rows);
}

export async function loadFoldKit(which: FoldPhoto = "IMG_6505"): Promise<FoldKit> {
  const imageSrc = `/sample/${which}.jpg`;
  const file = path.join(process.cwd(), "public/sample", `${which}.jpg`);
  const fallbackKit = which === "IMG_6208" ? HANDOFF_KITS.IMG_6208 : HANDOFF_KITS.IMG_6505;
  try {
    const buffer = await readFile(file);
    const meta = await sharp(buffer).metadata();
    const palette = await extractPalette(buffer);
    const colors: Array<Omit<FoldColor, "derivedFrom">> = [];
    COLOR_ROLES.forEach((role, position) => {
      const hex = palette.roles[role];
      if (!hex) return;
      const swatch =
        palette.swatches.find((row) => row.role === role) ??
        palette.swatches.find((row) => row.hex.toLowerCase() === hex.toLowerCase());
      colors.push({
        hex,
        role,
        position,
        pinX: swatch?.pinX ?? 0.5,
        pinY: swatch?.pinY ?? 0.5,
      });
    });
    return {
      title: which === "IMG_6505" ? "Yellow Victorian" : which === "IMG_6208" ? "Blue storefront" : "Red mural",
      imageSrc,
      width: meta.width ?? 1500,
      height: meta.height ?? 2000,
      colors: markDerivedRoles(colors),
    };
  } catch {
    return {
      title: which === "IMG_6505" ? "Yellow Victorian" : which === "IMG_6208" ? "Blue storefront" : "Red mural",
      imageSrc,
      width: 1500,
      height: 2000,
      colors: colorsFromKit(fallbackKit),
    };
  }
}

export function dropRoles(colors: FoldColor[], roles: ColorRole[]): FoldColor[] {
  return colors.filter((color) => !roles.includes(color.role));
}
