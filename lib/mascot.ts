import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { isHexColor, normalizeHex } from "@/lib/colors";

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
export const MASCOT_SIZE_PX = 48;
export const BAKU_CREAM = "#f3ead8";
export const BAKU_SEAM = "#b7a88a";
export const BAKU_MET_STORAGE_KEY = "inzpo-met-baku";

/** Future Rive file: matching state machine + one color input per token role. */
export const MASCOT_RIVE_STATE_MACHINE = "Baku";
export const MASCOT_RIVE_POSE_INPUT = "pose";
export const MASCOT_RIVE_COLOR_INPUTS = COLOR_ROLES;

export type MascotKit = Record<ColorRole, string>;

export const MASCOT_COPY = {
  "first-open": "This is Baku. It eats colors.",
  empty: "Nothing to chew on yet.",
  chewing: "Chewing on it.",
  "chewing-still": "Still chewing. Your colors are already here.",
  success: "Saved. Baku is full.",
  "error-brief": "Couldn't finish the notes. Your colors are fine.",
  "error-unreadable": "Baku can't taste this one. Try another photo.",
} as const;

export type MascotCopyKey = keyof typeof MASCOT_COPY;

/** #53 handoff palettes, token order. IMG_6208 has four swatches — pad with cream. */
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
    accent: BAKU_CREAM,
    background: "#384b5f",
    surface: BAKU_CREAM,
    text: "#bec6cd",
  },
} as const satisfies Record<string, MascotKit>;

export function creamKit(): MascotKit {
  return {
    primary: BAKU_CREAM,
    secondary: BAKU_CREAM,
    accent: BAKU_CREAM,
    background: BAKU_CREAM,
    surface: BAKU_CREAM,
    text: BAKU_CREAM,
  };
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
 * error-brief keeps the saved palette. Only error-unreadable (and idle/empty,
 * which have not eaten a kit yet) go back to a cream coat.
 */
export function kitForPose(pose: MascotPose, kit: MascotKit | null | undefined): MascotKit {
  if (pose === "error-unreadable" || pose === "empty" || pose === "idle") {
    return creamKit();
  }
  return kit ?? creamKit();
}

export function kitHasPalette(kit: MascotKit): boolean {
  const cream = BAKU_CREAM.toLowerCase();
  return COLOR_ROLES.some((role) => kit[role].toLowerCase() !== cream);
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

function hexOrCream(value: string): string {
  if (!isHexColor(value)) return BAKU_CREAM;
  return normalizeHex(value);
}

export function kitFromColors(
  colors: ReadonlyArray<{ hex: string; role?: ColorRole | null }>,
): MascotKit {
  const kit = creamKit();
  const used = new Set<number>();
  for (const role of COLOR_ROLES) {
    const index = colors.findIndex((color, i) => color.role === role && !used.has(i));
    if (index < 0) continue;
    kit[role] = hexOrCream(colors[index]!.hex);
    used.add(index);
  }
  for (const role of COLOR_ROLES) {
    if (kit[role] !== BAKU_CREAM) continue;
    const index = colors.findIndex((_, i) => !used.has(i));
    if (index < 0) break;
    kit[role] = hexOrCream(colors[index]!.hex);
    used.add(index);
  }
  return kit;
}

export function stripeCssVars(kit: MascotKit): Record<`--baku-${string}`, string> {
  return {
    "--baku-cream": BAKU_CREAM,
    "--baku-seam": BAKU_SEAM,
    "--baku-primary": kit.primary,
    "--baku-secondary": kit.secondary,
    "--baku-accent": kit.accent,
    "--baku-background": kit.background,
    "--baku-surface": kit.surface,
    "--baku-text": kit.text,
  };
}

export function stripeFills(kit: MascotKit): string[] {
  return COLOR_ROLES.map((role) => kit[role]);
}
