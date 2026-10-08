import { hexToFamily } from "@/lib/colors";
import { sanitizeChipLabel, type NamedColor } from "@/lib/brief-copy";

export const UNTITLED_KIT = "Untitled kit";

const CAMERA_FILE =
  /^(img|dscn?|pxl|mvimg|screenshot)[\s._-]?\d/i;
const STREET =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy|address)\b/i;
const COLOR_WORDS =
  /\b(red|orange|yellow|gold|green|teal|blue|purple|pink|brown|black|white|gray|grey|cream|beige)\b/i;
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "with",
  "its",
  "this",
  "that",
  "from",
  "into",
  "onto",
  "for",
  "on",
  "in",
  "at",
  "to",
]);

export function isCameraFilename(filename: string | null | undefined): boolean {
  if (!filename) return false;
  const base = filename.replace(/\.[a-z0-9]+$/i, "").trim();
  return CAMERA_FILE.test(base);
}

function looksLikeDeviceTitle(title: string): boolean {
  const trimmed = title.trim();
  if (CAMERA_FILE.test(trimmed)) return true;
  if (/^img[\s_-]*\d+/i.test(trimmed)) return true;
  return false;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function colorWordFrom(namedColors: NamedColor[] | undefined): string | null {
  const first = namedColors?.find((c) => c.label || c.hex);
  if (!first) return null;
  const fromLabel = first.label?.match(COLOR_WORDS)?.[1];
  if (fromLabel) return fromLabel.toLowerCase();
  const family = hexToFamily(first.hex);
  if (family === "cream/beige") return "cream";
  return family;
}

function subjectFromBrief(briefText: string | null | undefined): string | null {
  if (!briefText) return null;
  const cleaned = briefText.replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const words = cleaned.split(" ").filter(
    (word) =>
      word.length > 2 &&
      !COLOR_WORDS.test(word) &&
      !STREET.test(word) &&
      !STOPWORDS.has(word.toLowerCase()),
  );
  const pick = words.find((word) => /^[A-Z]/.test(word)) ?? words[0];
  if (!pick) return null;
  return pick.toLowerCase();
}

function subjectFromChips(namedColors: NamedColor[] | undefined): string | null {
  for (const color of namedColors ?? []) {
    const label = sanitizeChipLabel(color.label);
    if (!label) continue;
    const withoutColor = label.replace(COLOR_WORDS, "").trim();
    if (withoutColor.length > 0) return withoutColor.toLowerCase();
  }
  return null;
}

export function kitDisplayName(input: {
  title?: string | null;
  briefText?: string | null;
  namedColors?: NamedColor[];
  pending?: boolean;
}): string {
  if (input.pending) return UNTITLED_KIT;
  const title = input.title?.trim() ?? "";
  if (title && !looksLikeDeviceTitle(title) && !/\d/.test(title) && !STREET.test(title)) {
    return title;
  }
  const color = colorWordFrom(input.namedColors);
  const subject = subjectFromBrief(input.briefText) ?? subjectFromChips(input.namedColors);
  if (color && subject && subject !== color) return titleCase(`${color} ${subject}`);
  if (subject) return titleCase(subject);
  return UNTITLED_KIT;
}

export function generatedKitTitle(input: {
  title?: string | null;
  briefText?: string | null;
  namedColors?: NamedColor[];
}): string | null {
  const name = kitDisplayName({ ...input, pending: false });
  if (!name || name === UNTITLED_KIT) return null;
  return name;
}

/** Short photo alt from the kit name; never a camera filename or Untitled kit. */
export function kitAltText(input: {
  title?: string | null;
  briefText?: string | null;
  namedColors?: NamedColor[];
  pending?: boolean;
}): string {
  if (input.pending) return "Photo";
  const name = kitDisplayName({ ...input, pending: false });
  if (name === UNTITLED_KIT) return "Photo";
  return name;
}
