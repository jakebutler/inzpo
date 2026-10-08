import { hexToFamily } from "@/lib/colors";
import { sanitizeChipLabel, type NamedColor } from "@/lib/brief-copy";

export const UNTITLED_KIT = "Untitled kit";

const CAMERA_FILE =
  /^(img|dscn?|pxl|mvimg|screenshot)[\s._-]?\d/i;
const STREET =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy|address)\b/i;
const COLOR_WORDS =
  /\b(red|orange|yellow|gold|green|teal|blue|purple|pink|brown|black|white|gray|grey|cream|beige)\b/i;
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

function colorFamily(word: string): string | undefined {
  return Object.keys(COLOR_NAMES).find((family) => COLOR_NAMES[family].includes(word));
}
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

function subjectFromBrief(briefText: string | null | undefined, color: string | null): string | null {
  if (!briefText) return null;
  const cleaned = briefText.replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const family = color ? colorFamily(color) : null;
  const words = cleaned.split(" ").filter(
    (word) =>
      word.length > 2 &&
      (!COLOR_WORDS.test(word) ||
        (word.toLowerCase() !== color && colorFamily(word.toLowerCase()) === family)) &&
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
  const title = input.title?.trim() ?? "";
  // Display only the persisted title, even while a brief is loading or retrying.
  return title && !isCameraFilename(title) ? title : UNTITLED_KIT;
}

export function generatedKitTitle(input: {
  title?: string | null;
  briefText?: string | null;
  namedColors?: NamedColor[];
}): string | null {
  const existing = kitDisplayName({ title: input.title });
  if (existing !== UNTITLED_KIT) return existing;
  const color = colorWordFrom(input.namedColors);
  const subject = subjectFromBrief(input.briefText, color) ?? subjectFromChips(input.namedColors);
  const words = [...new Set(subject?.split(/\s+/).filter(Boolean) ?? [])];
  if (color && !words.some((word) => colorFamily(word) === colorFamily(color))) {
    words.push(color);
  }
  return words.length ? titleCase(words.join(" ")) : null;
}

/** Photo alt uses the same persisted title as the visible kit name. */
export function kitAltText(input: {
  title?: string | null;
  briefText?: string | null;
  namedColors?: NamedColor[];
  pending?: boolean;
}): string {
  return kitDisplayName(input);
}
