import { colorHue } from "@inzpo/shared";
import { type NamedColor } from "@/lib/brief-copy";

const UNTITLED_KIT = "Untitled kit";

/** Measured Primary supplies the color; only a recognized subject supplies the noun. */
export function primaryKitTitle(primary: string | null | undefined, source: {
  title?: string | null; briefText?: string | null; subject?: string | null; namedColors?: NamedColor[];
} = {}): string {
  if (!primary) return UNTITLED_KIT;
  const visionSubject = source.subject?.trim().toLowerCase();
  // An explicit vision noun is not limited to the legacy brief vocabulary.
  const explicit = visionSubject && /^\p{L}{1,40}$/u.test(visionSubject) && !COLOR_WORDS.test(visionSubject) && visionSubject !== 'kit'
    ? visionSubject : null;
  // A generic vision response must not hide a style recognized in the brief.
  const style = architecturalStyle(source.subject) ?? ((!explicit || GENERIC_BUILDINGS.has(explicit))
    ? architecturalStyle(source.briefText) ?? architecturalStyle(source.title)
      ?? source.namedColors?.map((color) => architecturalStyle(color.label)).find(Boolean)
    : null);
  const subject = style ?? explicit ?? subjectFromBrief(source.briefText) ?? subjectFromTitle(source.title) ?? subjectFromChips(source.namedColors);
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
const ARCHITECTURAL_STYLES = new Set('victorian craftsman colonial bungalow ranch tudor'.split(' '));
const GENERIC_BUILDINGS = new Set('house home building townhouse'.split(' '));
const SUBJECTS = new Set([...ARCHITECTURAL_STYLES, ...GENERIC_BUILDINGS, ...`cottage cabin facade wall door window trim siding roof brick stone garden flower leaf tree forest sky sea ocean beach mountain lake river boat car bike chair table lamp book fabric textile bowl cup vase mural painting poster sculpture dog cat bird fruit apple lemon orange cafe kitchen room courtyard balcony porch arch tower barn bridge sunset sunrise`.split(' ')]);
const ADDRESS = /\b(?:\d+\s+[\p{L}'-]+(?:\s+[\p{L}'-]+){0,3}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy)|[\p{L}'-]+(?:\s+[\p{L}'-]+){0,2}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy))\b/giu;

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
  // Architectural style is the subject even if prose mentions siding/trim first.
  const style = words.find((word) => ARCHITECTURAL_STYLES.has(word));
  if (style) return style;
  return words.find((word) => SUBJECTS.has(word) && !COLOR_WORDS.test(word)) ?? null;
}

function architecturalStyle(text: string | null | undefined): string | null {
  if (!text || looksLikeDeviceTitle(text)) return null;
  const words = text.replace(ADDRESS, ' ').toLowerCase().match(/\p{L}+/gu) ?? [];
  return words.find((word) => ARCHITECTURAL_STYLES.has(word)) ?? null;
}

function subjectFromChips(namedColors: NamedColor[] | undefined): string | null {
  for (const color of namedColors ?? []) {
    const noun = subjectFromBrief(color.label);
    if (noun) return noun;
  }
  return null;
}

