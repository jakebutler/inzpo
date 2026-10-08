import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { emptyRoles, filledRoles, rolesFromColors, type RoleColors } from "@/lib/tokens";
import { BAKU_UNDYED_KNIT } from "@/lib/baku-tint";

export const MASCOT_POSES = [
  "idle",
  "chewing",
  "success",
  "empty",
  "error-brief",
  "error-unreadable",
] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export const MASCOT_MOMENTS = [
  "first-open",
  "upload",
  "brief",
  "empty",
  "success",
  "error-brief",
  "error-unreadable",
] as const;
export type MascotMoment = (typeof MASCOT_MOMENTS)[number];

export const MASCOT_WAIT_MS = 300;
export const MASCOT_CHEW_COPY_MS = 15_000;
export const MASCOT_SUCCESS_HOLD_MS = 2_000;
export const MASCOT_SIZE_PX = 48;
export const MASCOT_SIZE_BRIEF_PX = 56;
export const MASCOT_SIZE_INTRO_PX = 64;
export const MASCOT_SIZE_UPLOAD_PX = 96;
export const BAKU_CREAM = "#f3ead8";
export const BAKU_SEAM = "#b7a88a";
export const BAKU_MET_STORAGE_KEY = "inzpo-met-baku";

/** Future Rive file: matching state machine + one color input per token role. */
export const MASCOT_RIVE_STATE_MACHINE = "Baku";
export const MASCOT_RIVE_POSE_INPUT = "pose";
export const MASCOT_RIVE_COLOR_INPUTS = COLOR_ROLES;

export type MascotKit = RoleColors;

export const MASCOT_COPY = {
  "first-open": "This is Baku. It eats colors.",
  empty: "Nothing to chew on yet.",
  chewing: "Chewing on it.",
  "chewing-still": "Still chewing. Your colors are already here.",
  success: "Saved. Baku is full.",
  "error-brief": "Couldn't finish the notes. Your colors are fine.",
  "error-brief-retry": "Couldn't read this one. Tap to retry.",
  "error-unreadable": "Baku can't taste this one. Try another photo.",
} as const;

export type MascotCopyKey = keyof typeof MASCOT_COPY;

/** Historical handoff palettes for static art previews, in token order. */
export const HANDOFF_KITS = {
  IMG_6505: {
    primary: "#6b6656",
    secondary: "#48463f",
    accent: "#ccc5b3",
    background: "#d1cda4",
    surface: "#a6a090",
    text: "#0a0c0b",
  },
  IMG_6208: {
    primary: "#7fafd4",
    secondary: "#a2afbd",
    accent: null,
    background: "#384b5f",
    surface: null,
    text: "#bec6cd",
  },
} as const satisfies Record<string, MascotKit>;

export function emptyKit(): MascotKit {
  return emptyRoles();
}

/** No kit colours; knit renderers supply undyed oatmeal. */
export function creamKit(): MascotKit {
  return emptyKit();
}

export function poseForMoment(moment: MascotMoment): MascotPose {
  switch (moment) {
    case "first-open":
      return "idle";
    case "upload":
    case "brief":
      return "chewing";
    case "empty":
      return "empty";
    case "success":
      return "success";
    case "error-brief":
      return "error-brief";
    case "error-unreadable":
      return "error-unreadable";
  }
}

/** Brief, uploads, and first open wait 300ms so a quick wait never flashes Baku. */
export function waitBeforeShow(moment: MascotMoment): boolean {
  return moment === "first-open" || moment === "upload" || moment === "brief";
}

/**
 * Poses without a knit patch go back to a cream coat.
 * Knit poses preserve the supplied kit, including empty roles.
 */
export function kitForPose(pose: MascotPose | "404" | "error-photo", kit: MascotKit | null | undefined): MascotKit {
  if (pose === "error-unreadable" || pose === "empty" || pose === "error-photo") {
    return emptyKit();
  }
  return kit ?? emptyKit();
}

export function kitHasPalette(kit: MascotKit): boolean {
  return filledRoles(kit).length > 0;
}

export function copyForMoment(
  moment: MascotMoment,
  chewElapsedMs = 0,
): (typeof MASCOT_COPY)[MascotCopyKey] {
  if (moment === "upload" || moment === "brief") {
    return chewElapsedMs >= MASCOT_CHEW_COPY_MS ? MASCOT_COPY["chewing-still"] : MASCOT_COPY.chewing;
  }
  if (moment === "first-open") return MASCOT_COPY["first-open"];
  if (moment === "empty") return MASCOT_COPY.empty;
  if (moment === "success") return MASCOT_COPY.success;
  if (moment === "error-brief") return MASCOT_COPY["error-brief"];
  return MASCOT_COPY["error-unreadable"];
}

export function kitFromColors(
  colors: ReadonlyArray<{ hex: string; role?: ColorRole | null }>,
): MascotKit {
  return rolesFromColors(colors);
}

export function stripeCssVars(kit: MascotKit): Record<`--baku-${string}`, string> {
  const vars: Record<`--baku-${string}`, string> = {
    "--baku-cream": BAKU_CREAM,
    "--baku-seam": BAKU_SEAM,
  };
  for (const role of COLOR_ROLES) {
    vars[`--baku-${role}`] = kit[role] || BAKU_UNDYED_KNIT;
  }
  return vars;
}

/** Dyed fills only, in token order. Undyed oatmeal is not a kit colour. */
export function stripeFills(kit: MascotKit): string[] {
  return filledRoles(kit).map((role) => kit[role]!);
}
