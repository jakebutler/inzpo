import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import type { MascotPose } from "@/lib/mascot";

export const BAKU_V6_DIR = "/baku/v6";
/** Designer v6 tint is on by default; explicitly set 0 to use colour sprites. */
export const BAKU_TINT_ENABLED = process.env.NEXT_PUBLIC_BAKU_TINT !== "0";
export const BAKU_CROSSFADE_MS = 150;
export const BAKU_BAND_GRAYS = [40, 80, 120, 160, 200, 240] as const;
/** Bottom slice of the sprite that holds the pale ground shadow. */
export const BAKU_SHADOW_CLIP_PCT = 10.5;

export const BAKU_ART_POSES = [
  "idle",
  "chewing",
  "success",
  "error-brief",
  "404",
  "empty",
  "error-photo",
] as const;
export type BakuArtPose = (typeof BAKU_ART_POSES)[number];

/** Knit-patch poses with index masks. empty and error-photo stay as-is. */
export const BAKU_TINT_POSES: ReadonlySet<BakuArtPose> = new Set([
  "idle",
  "chewing",
  "success",
  "error-brief",
  "404",
]);

export type BakuDensity = 1 | 2 | 3;
export type BakuSrcPose = MascotPose | BakuArtPose;

function isArtPose(pose: string): pose is BakuArtPose {
  return (BAKU_ART_POSES as readonly string[]).includes(pose);
}

export function bakuArtPose(pose: BakuSrcPose): BakuArtPose {
  if (pose === "error-unreadable") return "error-photo";
  if (isArtPose(pose)) return pose;
  throw new Error("Unknown Baku pose");
}

export function bakuCanTint(pose: BakuSrcPose): boolean {
  return BAKU_TINT_ENABLED && BAKU_TINT_POSES.has(bakuArtPose(pose));
}

export function bakuDensity(dpr: number): BakuDensity {
  if (!Number.isFinite(dpr) || dpr < 1.5) return 1;
  if (dpr < 2.5) return 2;
  return 3;
}

function densityOrThrow(density: BakuDensity): BakuDensity {
  if (density !== 1 && density !== 2 && density !== 3) throw new Error("Baku density must be 1, 2, or 3");
  return density;
}

export function bakuV6PoseSrc(pose: BakuSrcPose, density: BakuDensity = 1): string {
  return `${BAKU_V6_DIR}/baku-${bakuArtPose(pose)}@${densityOrThrow(density)}x.png`;
}

export function bakuV6ColorSrc(pose: BakuSrcPose, density: BakuDensity = 1): string {
  return `${BAKU_V6_DIR}/baku-${bakuArtPose(pose)}-color@${densityOrThrow(density)}x.png`;
}

export function bakuV6ShadeSrc(pose: BakuSrcPose, density: BakuDensity = 1): string {
  return `${BAKU_V6_DIR}/baku-${bakuArtPose(pose)}-shade@${densityOrThrow(density)}x.png`;
}

export function bakuV6PoseSrcSet(pose: BakuSrcPose): string {
  return `${bakuV6PoseSrc(pose, 1)} 1x, ${bakuV6PoseSrc(pose, 2)} 2x, ${bakuV6PoseSrc(pose, 3)} 3x`;
}

/** Combined grayscale knit mask at the sprite density. Band roles live at gray 40–240. */
export function bakuV6BandsSrc(pose: BakuSrcPose, density: BakuDensity = 1): string {
  return `${BAKU_V6_DIR}/baku-${bakuArtPose(pose)}-bands@${densityOrThrow(density)}x.png`;
}

/** One-band 1-bit mask at the sprite density, in token order (band1 = primary). */
export function bakuV6BandMaskSrc(pose: BakuSrcPose, role: ColorRole, density: BakuDensity = 1): string {
  if (!COLOR_ROLES.includes(role)) throw new Error("Unknown color role");
  const n = COLOR_ROLES.indexOf(role) + 1;
  return `${BAKU_V6_DIR}/baku-${bakuArtPose(pose)}-band${n}@${densityOrThrow(density)}x.png`;
}

export function bakuV6BandGray(role: ColorRole): number {
  const index = COLOR_ROLES.indexOf(role);
  if (index < 0) throw new Error("Unknown color role");
  return BAKU_BAND_GRAYS[index] ?? BAKU_BAND_GRAYS[BAKU_BAND_GRAYS.length - 1]!;
}

export function isBakuV6Path(path: string): boolean {
  return typeof path === "string" && path.startsWith(`${BAKU_V6_DIR}/`);
}
