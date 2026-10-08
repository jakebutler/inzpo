import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { extractPalette } from "@/lib/palette-extract";
import { HANDOFF_KITS, type MascotKit } from "@/lib/mascot";

export type FoldColor = {
  hex: string;
  role: ColorRole;
  position: number;
  pinX: number;
  pinY: number;
};

export type FoldKit = {
  title: string;
  imageSrc: string;
  width: number;
  height: number;
  colors: FoldColor[];
};

function colorsFromKit(kit: MascotKit): FoldColor[] {
  return COLOR_ROLES.flatMap((role, position) => {
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
}

export async function loadFoldKit(which: "IMG_6505" | "IMG_6208" = "IMG_6505"): Promise<FoldKit> {
  const imageSrc = "/sample/IMG_6505.jpg";
  const file = path.join(process.cwd(), "public/sample/IMG_6505.jpg");
  try {
    const buffer = await readFile(file);
    const meta = await sharp(buffer).metadata();
    if (which === "IMG_6208") {
      return {
        title: "IMG_6208",
        imageSrc,
        width: meta.width ?? 1500,
        height: meta.height ?? 2000,
        colors: colorsFromKit(HANDOFF_KITS.IMG_6208),
      };
    }
    const palette = await extractPalette(buffer);
    const colors: FoldColor[] = [];
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
      title: "IMG_6505",
      imageSrc,
      width: meta.width ?? 1500,
      height: meta.height ?? 2000,
      colors: colors.length > 0 ? colors : colorsFromKit(HANDOFF_KITS.IMG_6505),
    };
  } catch {
    return {
      title: which,
      imageSrc,
      width: 1500,
      height: 2000,
      colors: colorsFromKit(HANDOFF_KITS[which]),
    };
  }
}

export function dropRoles(colors: FoldColor[], roles: ColorRole[]): FoldColor[] {
  return colors.filter((color) => !roles.includes(color.role));
}
