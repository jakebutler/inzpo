import { hexToFamily } from "@/lib/colors";
import { colorHue } from "@inzpo/shared";
import { type NamedColor } from "@/lib/brief-copy";

export const UNTITLED_KIT = "Untitled kit";

/** Measured Primary supplies the color; only a recognized subject supplies the noun. */
export function primaryKitTitle(primary: string | null | undefined, source: {
  title?: string | null; briefText?: string | null; subject?: string | null; namedColors?: NamedColor[];
} = {}): string {
  if (!primary) return UNTITLED_KIT;
  const visionSubject = source.subject?.trim().toLowerCase();
  // An explicit vision noun is not limited to the legacy brief vocabulary.
  const subject = visionSubject && /^\p{L}{1,40}$/u.test(visionSubject) && !COLOR_WORDS.test(visionSubject) && visionSubject !== 'kit'
    ? visionSubject : subjectFromBrief(source.briefText) ?? subjectFromTitle(source.title) ?? subjectFromChips(source.namedColors);
  return subject ? titleCase(`${colorHue(primary)} ${subject}`) : `${titleCase(colorHue(primary))} kit`;
}

const CAMERA_FILE =
  /^(img|dscn?|pxl|mvimg|screenshot)[\s._-]?\d/i;
const STREET =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy|address)\b/i;
const COLOR_WORDS =
  /\b(red|orange|yellow|gold|green|teal|blue|purple|pink|brown|black|white|gray|grey|cream|beige)\b/i;
// A conservative vocabulary avoids guessing that an adjective or proper name
// is a noun. Unknown subjects deliberately fall back to "kit".
const SUBJECTS = new Set(`victorian house cottage bungalow cabin building facade wall door window trim siding roof brick stone garden flower leaf tree forest sky sea ocean beach mountain lake river boat car bike chair table lamp book fabric textile bowl cup vase mural painting poster sculpture dog cat bird fruit apple lemon orange cafe kitchen room courtyard balcony porch arch tower barn bridge sunset sunrise`.split(' '));
const ADDRESS = /\b(?:\d+\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,3}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy)|[\p{L}'-]+(?:\s+[\p{L}'-]+){0,2}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy))\b/giu;

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

function subjectFromTitle(title: string | null | undefined): string | null {
  if (!title || looksLikeDeviceTitle(title) || /\d/.test(title) || STREET.test(title)) return null;
  const prefixed = title.trim().match(/^(red|orange|yellow|gold|green|teal|blue|purple|pink|brown|black|white|gray|grey|cream|beige)\s+(\p{L}+)$/iu);
  const noun = prefixed?.[2].toLowerCase();
  return noun && SUBJECTS.has(noun) ? noun : subjectFromBrief(title);
}

function subjectFromBrief(briefText: string | null | undefined): string | null {
  if (!briefText || looksLikeDeviceTitle(briefText)) return null;
  // Remove the complete address phrase before scanning, so "Garden Street"
  // cannot masquerade as a garden. Prefer a fallback over guessing an address.
  const cleaned = briefText.replace(ADDRESS, ' ');
  const words: string[] = cleaned.toLowerCase().match(/\p{L}+/gu) ?? [];
  // A Victorian is the subject even if prose mentions siding/trim first.
  if (words.includes('victorian')) return 'victorian';
  return words.find((word) => SUBJECTS.has(word) && !COLOR_WORDS.test(word)) ?? null;
}

function subjectFromChips(namedColors: NamedColor[] | undefined): string | null {
  for (const color of namedColors ?? []) {
    const noun = subjectFromBrief(color.label);
    if (noun) return noun;
  }
  return null;
}

export function kitDisplayName(input: {
  title?: string | null;
  briefText?: string | null;
  namedColors?: NamedColor[];
  pending?: boolean;
  primary?: { hex: string; name?: string | null } | null;
}): string {
  if (input.pending) return UNTITLED_KIT;
  const title = input.title?.trim() ?? "";
  const prefixedColor = title.match(COLOR_WORDS)?.[1]?.toLowerCase();
  const color = input.primary ? colorHue(input.primary.hex, input.primary.name) : colorWordFrom(input.namedColors) ?? prefixedColor;
  const subject = subjectFromTitle(title) ?? subjectFromBrief(input.briefText) ?? subjectFromChips(input.namedColors);
  if (color && subject) return titleCase(`${color} ${subject}`);
  if (color) return `${titleCase(color)} kit`;
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
