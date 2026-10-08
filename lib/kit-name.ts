import { hexToFamily, hexToHsl, isHexColor } from "@/lib/colors";
import { sanitizeChipLabel, type NamedColor } from "@/lib/brief-copy";
import { sanitizeBriefSubject, subjectFromBrief } from "@/lib/brief-subject";
import { isRecentPendingBrief, STALE_PENDING_MS, type BriefState } from "@/lib/brief-state";

export const UNTITLED_KIT = "Untitled kit";

const CAMERA_FILE = /^(img|dscn?|pxl|mvimg|screenshot)[\s._-]?\d/i;
const COLOR_NAMES: Record<string, string[]> = {
  red: ["red", "crimson", "scarlet", "ruby"],
  orange: ["orange", "tangerine", "apricot", "amber", "rust"],
  yellow: ["yellow", "mustard", "canary", "gold"],
  blue: ["blue", "navy", "cobalt", "azure", "indigo"],
  green: ["green", "sage", "olive", "emerald"],
  teal: ["teal", "turquoise", "aqua", "cyan"],
  purple: ["purple", "violet", "lavender", "lilac", "plum", "mauve", "amethyst"],
  pink: ["pink", "rose", "blush", "coral", "fuchsia", "magenta"],
  brown: ["brown", "chocolate", "chestnut", "sepia"],
  cream: ["cream", "beige", "ivory", "ecru"],
  gray: ["gray", "grey", "silver", "slate", "charcoal", "ash", "graphite"],
  black: ["black", "ebony", "onyx", "jet"],
  white: ["white", "alabaster"],
};
const COLOR_MODIFIERS = new Set((
  "butter lemon honey sky ocean sea midnight mint forest moss leaf brick terracotta copper steel slate stone pearl sand snow eggshell " +
  "soft pale deep light dark bright muted dusty warm cool rich"
).split(" "));

function colorFamily(word: string): string | undefined {
  return Object.keys(COLOR_NAMES).find((family) => COLOR_NAMES[family].includes(word));
}

export function isCameraFilename(filename: string | null | undefined): boolean {
  if (!filename) return false;
  const base = filename.replace(/\.[a-z0-9]+$/i, "").trim();
  return CAMERA_FILE.test(base);
}

function titleCase(value: string): string {
  return value.split(/\s+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function primaryFamily(hex: string | null | undefined): string | null {
  if (!hex || !isHexColor(hex)) return null;
  const family = hexToFamily(hex.trim());
  // RGB chroma below 0.12 (~31/255) reads neutral in muted blues, including #a0adbb.
  // Keep this naming threshold local so palette taxonomy/extraction is unchanged.
  const { h, chroma } = hexToHsl(hex.trim());
  if (h >= 160 && h < 255 && chroma < 0.12 && family !== "black" && family !== "white") return "gray";
  if (family === "cream/beige") return "cream";
  if (family === "gold") return "yellow";
  return family;
}

const ADJECTIVE_MODIFIERS = new Set("soft pale deep light dark bright muted dusty warm cool rich".split(" "));

function colorPart(input: KitNameInput, family: string, nounModifiersOnly = false): string {
  const sources = [input.briefText, ...(input.namedColors ?? []).map((chip) => sanitizeChipLabel(chip.label))];
  for (const source of sources) {
    // Only adjacent modifier + colour pairs; punctuation cannot join unrelated phrases.
    const pairs = source?.toLowerCase().matchAll(/(?=\b(([a-z]+)[ -]+([a-z]+))\b)/g) ?? [];
    for (const pair of pairs) {
      const [, phrase, modifier, color] = pair;
      if (colorFamily(color) !== family || !COLOR_MODIFIERS.has(modifier)) continue;
      if (nounModifiersOnly && ADJECTIVE_MODIFIERS.has(modifier)) continue;
      const modifierFamily = colorFamily(modifier);
      if (modifierFamily && modifierFamily !== family) continue;
      const next = source?.slice(pair.index! + phrase.length).match(/^[- ]+([a-z]+)\b/i)?.[1].toLowerCase();
      if (next && colorFamily(next) && colorFamily(next) !== family) continue;
      return modifier + " " + family;
    }
  }
  return family;
}

export type KitNameInput = {
  title?: string | null;
  briefText?: string | null;
  subject?: string | null;
  primaryHex?: string | null;
  namedColors?: NamedColor[];
  pending?: boolean;
  brief?: BriefState | null;
  createdAt?: Date | string;
};

/** Stable colour-only name, also used to recognise a fallback on a later retry. */
export function fallbackKitName(primaryHex: string | null | undefined): string {
  return titleCase(colorPart({}, primaryFamily(primaryHex) ?? "gray"));
}

export function kitDisplayName(input: KitNameInput, now = Date.now()): string {
  const existing = generatedKitTitle({ title: input.title });
  if (existing) return existing;
  if (input.brief === undefined && input.createdAt != null) {
    const createdAt = new Date(input.createdAt).getTime();
    return now - createdAt < STALE_PENDING_MS ? "" : fallbackKitName(input.primaryHex);
  }
  if (isRecentPendingBrief(input.brief, now)) return "";
  if (input.brief && (input.brief.status !== "ready" || input.brief.stub)) return fallbackKitName(input.primaryHex);
  return generatedKitTitle(input) ?? fallbackKitName(input.primaryHex);
}

export function generatedKitTitle(input: KitNameInput): string | null {
  const existing = input.title?.trim() ?? "";
  if (existing && existing !== UNTITLED_KIT && !isCameraFilename(existing)) return existing;
  const subject = sanitizeBriefSubject(input.subject) ?? subjectFromBrief(input.briefText);
  const family = primaryFamily(input.primaryHex);
  // With a subject, only a noun modifier ("Facade Butter Yellow") joins it, never "Facade Pale Yellow".
  const color = family ? colorPart(input, family, Boolean(subject)) : null;
  return subject || color ? titleCase([subject, color].filter(Boolean).join(" ")) : null;
}

/** Photo alt uses the same name as the visible kit name. */
export function kitAltText(input: KitNameInput): string {
  return kitDisplayName(input);
}
