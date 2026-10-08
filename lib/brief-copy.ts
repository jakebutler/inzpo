import { hexToLab, MIN_ROLE_DELTA_E, roleDeltaE } from "@/lib/color-distance";
import { hexToFamily, isHexColor, normalizeHex } from "@/lib/colors";

const STREET =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy|address)\b/i;
const PLATE = /\b(plate|license|number plate)\b/i;

export interface NamedColor {
  hex: string;
  label: string | null;
  source?: string;
  pinX?: number;
  pinY?: number;
}

/** Common noun phrase, 4 words or fewer. No addresses, street names, plates, or house numbers. */
export function sanitizeChipLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const label = raw.trim().replace(/\s+/g, " ");
  if (label.length === 0) return null;
  const words = label.split(" ");
  if (words.length > 4) return null;
  if (/\d/.test(label)) return null;
  if (STREET.test(label) || PLATE.test(label)) return null;
  return label;
}

const COLOR_WORD =
  /\b(red|orange|yellow|gold|green|teal|blue|purple|pink|brown|black|white|gray|grey|cream|beige)\b/i;

const FAMILY_NOUN: Record<string, string> = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  "cream/beige": "beige",
  brown: "brown",
  gold: "gold",
  green: "green",
  teal: "teal",
  blue: "blue",
  purple: "purple",
  pink: "pink",
  black: "black",
  white: "white",
  gray: "gray",
};

function colorWordMatchesFamily(word: string, family: string): boolean {
  const w = word.toLowerCase();
  if (family === "cream/beige") return w === "cream" || w === "beige";
  if (family === "gray") return w === "gray" || w === "grey";
  if (family === "gold") return w === "gold" || w === "yellow";
  return w === family;
}

/** True when the brief's noun does not contradict the sampled swatch. */
export function labelMatchesSample(label: string | null, hex: string): boolean {
  const clean = sanitizeChipLabel(label);
  if (!clean) return false;
  const mentioned = clean.match(COLOR_WORD)?.[1];
  if (!mentioned) return true;
  return colorWordMatchesFamily(mentioned, hexToFamily(hex));
}

/** Noun under the pin. If the brief color-word disagrees with the sample, use the color name. */
export function chipNoun(label: string | null, hex: string): string {
  if (labelMatchesSample(label, hex)) {
    const clean = sanitizeChipLabel(label);
    if (clean) return clean;
  }
  return FAMILY_NOUN[hexToFamily(hex)] ?? "color";
}

export function chipCopy(label: string | null, hex?: string): string {
  const clean = hex ? chipNoun(label, hex) : sanitizeChipLabel(label);
  if (!clean) return "Baku spotted another color. Add it?";
  if (/^(a|an|the)\s/i.test(clean)) return `Baku spotted ${clean}. Add it?`;
  const article = /^[aeiou]/i.test(clean) ? "an" : "a";
  return `Baku spotted ${article} ${clean}. Add it?`;
}

/** Accept `#rrggbb` or `rrggbb`; drop anything that is not a 6-digit hex after normalize. */
export function namedColorHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!isHexColor(trimmed)) return null;
  const hex = normalizeHex(trimmed);
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

/** Model suggestions are untrusted candidates until snapped to measured regions. */
export function parseNamedColorCandidates(raw: unknown, fallbackHexes: string[] = []): NamedColor[] {
  const out: NamedColor[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") {
        const hex = namedColorHex(entry);
        if (hex) out.push({ hex, label: null });
        continue;
      }
      if (entry && typeof entry === "object" && "hex" in entry && typeof (entry as { hex: unknown }).hex === "string") {
        const hex = namedColorHex((entry as { hex: string }).hex);
        if (!hex) continue;
        const row = entry as { hex: string; label?: unknown; source?: unknown; pinX?: unknown; pinY?: unknown };
        const pin = typeof row.pinX === "number" && Number.isFinite(row.pinX) && row.pinX >= 0 && row.pinX <= 1 &&
          typeof row.pinY === "number" && Number.isFinite(row.pinY) && row.pinY >= 0 && row.pinY <= 1
          ? { pinX: row.pinX, pinY: row.pinY } : {};
        out.push({ hex, label: sanitizeChipLabel(row.label),
          ...(typeof row.source === "string" ? { source: row.source } : row.source === undefined ? {} : { source: "unknown" }), ...pin });
      }
    }
  }
  if (out.length === 0) {
    for (const rawHex of fallbackHexes) {
      const hex = namedColorHex(rawHex);
      if (hex) out.push({ hex, label: null });
    }
  }
  return out;
}

/** Display only suggestions carrying the region marker written since r8.4. */
export function parseNamedColors(raw: unknown, fallbackHexes: string[] = []): NamedColor[] {
  return parseNamedColorCandidates(raw, fallbackHexes).filter((color) => color.source === "region");
}

export const EMPTY_ROLE_COPY = (role: string): string => `No ${role} in this one. Add a color.`;

/**
 * Client-side guard for chips after the kit changes (e.g. a pin dragged onto
 * the suggested surface): hide a measured chip that is now within CIE76 ΔE 12
 * of any filled role. Same-source hiding needs the region map and runs at snap time.
 */
export function chipsDistinctFromRoles(chips: readonly NamedColor[], filledHexes: Iterable<string>): NamedColor[] {
  const filled = Array.from(filledHexes, (hex) => hexToLab(hex));
  return chips.filter((chip) => filled.every((lab) => roleDeltaE(hexToLab(chip.hex), lab) >= MIN_ROLE_DELTA_E));
}
