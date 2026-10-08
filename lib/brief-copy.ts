const STREET =
  /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl|highway|hwy|address)\b/i;
const PLATE = /\b(plate|license|number plate)\b/i;

export interface NamedColor {
  hex: string;
  label: string | null;
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

export function chipCopy(label: string | null): string {
  const clean = sanitizeChipLabel(label);
  if (!clean) return "Baku spotted another color. Add it?";
  if (/^(a|an|the)\s/i.test(clean)) return `Baku spotted ${clean}. Add it?`;
  const article = /^[aeiou]/i.test(clean) ? "an" : "a";
  return `Baku spotted ${article} ${clean}. Add it?`;
}

export function parseNamedColors(raw: unknown, fallbackHexes: string[] = []): NamedColor[] {
  const out: NamedColor[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") {
        out.push({ hex: entry, label: null });
        continue;
      }
      if (entry && typeof entry === "object" && "hex" in entry && typeof (entry as { hex: unknown }).hex === "string") {
        const row = entry as { hex: string; label?: unknown };
        out.push({ hex: row.hex, label: sanitizeChipLabel(row.label) });
      }
    }
  }
  if (out.length === 0) {
    for (const hex of fallbackHexes) out.push({ hex, label: null });
  }
  return out;
}

export const EMPTY_ROLE_COPY = (role: string): string => `No ${role} in this one. Add a color.`;
