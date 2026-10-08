import { PAPER } from "@/lib/brand";
import { HANDOFF_KITS } from "@/lib/mascot";

export const QA_PAPER = PAPER.toLowerCase();

export function cssRgbToHex(color: string): string | null {
  if (typeof color !== "string" || color.length === 0) return null;
  const trimmed = color.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "rgba(0, 0, 0, 0)") return null;
  if (trimmed.startsWith("#")) {
    const raw = trimmed.slice(1);
    if (raw.length === 3) {
      return `#${raw.split("").map((c) => c + c).join("")}`;
    }
    if (raw.length === 6) return `#${raw}`;
    return null;
  }
  const m = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const hex = [m[1], m[2], m[3]]
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

export function isWhiteOrEmptyHex(hex: string | null): boolean {
  if (!hex) return true;
  const n = hex.toLowerCase();
  return n === "#ffffff" || n === "#fff";
}

export const QA_KIT_HEXES: ReadonlySet<string> = new Set(
  Object.values(HANDOFF_KITS)
    .flatMap((kit) => Object.values(kit))
    .flatMap((hex) => (typeof hex === "string" ? [hex.toLowerCase()] : []))
    .concat(QA_PAPER),
);

/** Paper on chrome screens; paper or a kit swatch (or any non-white kit-wear fill) on kit screens. */
export function isAllowedCaptureBackground(
  hex: string | null,
  opts: { kitWear: boolean },
): boolean {
  if (!hex) return false;
  const n = hex.toLowerCase();
  if (n === "#ffffff" || n === "#fff") return false;
  if (n === QA_PAPER) return true;
  if (opts.kitWear) return QA_KIT_HEXES.has(n) || (n.startsWith("#") && n.length === 7);
  return false;
}

export type CaptureGuardSnapshot = {
  staticFails: string[];
  sheetCount: number;
  ruleCount: number;
  backgroundHex: string | null;
  kitWear: boolean;
  headlineFont: boolean;
  geist: boolean;
  documentStatus?: number;
  errorDocument?: boolean;
};

export function captureGuardIssues(snap: CaptureGuardSnapshot): string[] {
  const issues: string[] = [];
  if (snap.documentStatus !== undefined && snap.documentStatus !== 200) {
    issues.push(`document HTTP ${snap.documentStatus}`);
  }
  if (snap.errorDocument) issues.push("Next.js error document");
  if (snap.staticFails.length > 0) {
    issues.push(`static not 200: ${snap.staticFails.slice(0, 3).join("; ")}`);
  }
  if (snap.sheetCount < 1) issues.push("document.styleSheets is empty");
  if (snap.ruleCount < 1) issues.push("no CSS rules loaded");
  if (!isAllowedCaptureBackground(snap.backgroundHex, { kitWear: snap.kitWear })) {
    issues.push(`background ${snap.backgroundHex ?? "empty"} is not paper or a kit color`);
  }
  if (!snap.headlineFont) issues.push("Headline font (Akaya Kanadaka) is not loaded");
  if (!snap.geist) issues.push("Geist is not loaded");
  return issues;
}
