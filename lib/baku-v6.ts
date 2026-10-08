import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { MASCOT_POSES, type MascotPose } from "@/lib/mascot";

export const BAKU_V6_DIR = "/baku/v6";
export const BAKU_CROSSFADE_MS = 150;
export const BAKU_BAND_GRAYS = [40, 80, 120, 160, 200, 240] as const;

export type BakuDensity = 1 | 2 | 3;

export function bakuV6PoseSrc(pose: MascotPose, density: BakuDensity = 1): string {
  if (!MASCOT_POSES.includes(pose)) throw new Error("Unknown Baku pose");
  if (density !== 1 && density !== 2 && density !== 3) throw new Error("Baku density must be 1, 2, or 3");
  return `${BAKU_V6_DIR}/baku-${pose}@${density}x.png`;
}

export function bakuV6PoseSrcSet(pose: MascotPose): string {
  return `${bakuV6PoseSrc(pose, 1)} 1x, ${bakuV6PoseSrc(pose, 2)} 2x, ${bakuV6PoseSrc(pose, 3)} 3x`;
}

/** Combined grayscale knit mask. Band roles live at gray 40–240. */
export function bakuV6BandsSrc(pose: MascotPose): string {
  if (!MASCOT_POSES.includes(pose)) throw new Error("Unknown Baku pose");
  return `${BAKU_V6_DIR}/baku-${pose}-bands.png`;
}

/** One-band luminance mask at 1x, in token order. */
export function bakuV6BandMaskSrc(pose: MascotPose, role: ColorRole): string {
  if (!MASCOT_POSES.includes(pose)) throw new Error("Unknown Baku pose");
  if (!COLOR_ROLES.includes(role)) throw new Error("Unknown color role");
  return `${BAKU_V6_DIR}/baku-${pose}-band-${role}.png`;
}

export function bakuV6BandGray(role: ColorRole): number {
  const index = COLOR_ROLES.indexOf(role);
  if (index < 0) throw new Error("Unknown color role");
  return BAKU_BAND_GRAYS[index] ?? BAKU_BAND_GRAYS[BAKU_BAND_GRAYS.length - 1]!;
}

export function isBakuV6Path(path: string): boolean {
  return typeof path === "string" && path.startsWith(`${BAKU_V6_DIR}/`);
}
