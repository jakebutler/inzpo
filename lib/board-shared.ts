// Pure board domain math and validation — no DB imports (unit tests run without a database).

export const BOARD_PRESETS = {
  "16:9": { w: 1600, h: 900 },
  "1:1": { w: 1600, h: 1600 },
  "4:5": { w: 1280, h: 1600 },
  "9:16": { w: 900, h: 1600 },
  free: { w: 1600, h: 1200 },
} as const;
export type BoardPresetName = keyof typeof BOARD_PRESETS;

export const BOARD_PRESET_LABELS: Record<BoardPresetName, string> = {
  "16:9": "16:9 · 1600×900",
  "1:1": "1:1 · 1600×1600",
  "4:5": "4:5 · 1280×1600",
  "9:16": "9:16 · 900×1600",
  free: "Free · 1600×1200",
};

export const BACKGROUND_PRESETS = ["#0a0a0a", "#1c1c1c", "#f5f5f5", "#ffffff"] as const;

export const MAX_PLACEMENTS = 100;
export const MIN_PLACEMENT_SIZE = 48;
export const MAX_TITLE_LENGTH = 120;

export interface PlacementInput {
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  showLabel: boolean;
}

export interface RawPlacement {
  itemId?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  z?: unknown;
  showLabel?: unknown;
}

export function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

export function normalizeTitle(raw: string): string {
  const t = raw.trim().slice(0, MAX_TITLE_LENGTH);
  return t.length > 0 ? t : "Untitled board";
}

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function clampPlacement(raw: RawPlacement, canvas: { w: number; h: number }): PlacementInput | null {
  const itemId = typeof raw.itemId === "string" && raw.itemId.length > 0 ? raw.itemId : null;
  if (!itemId) return null;
  const w = Math.max(MIN_PLACEMENT_SIZE, Math.min(toInt(raw.w) ?? 0, canvas.w));
  const h = Math.max(MIN_PLACEMENT_SIZE, Math.min(toInt(raw.h) ?? 0, canvas.h));
  const x = Math.max(0, Math.min(toInt(raw.x) ?? 0, canvas.w - w));
  const y = Math.max(0, Math.min(toInt(raw.y) ?? 0, canvas.h - h));
  return {
    itemId,
    x,
    y,
    w,
    h,
    z: toInt(raw.z) ?? 0,
    showLabel: raw.showLabel === true,
  };
}

export function validatePlacements(raw: unknown, canvas: { w: number; h: number }): PlacementInput[] {
  if (!Array.isArray(raw)) throw new Error("placements must be an array");
  if (raw.length > MAX_PLACEMENTS) throw new Error(`too many placements (max ${MAX_PLACEMENTS})`);
  const out = new Map<string, PlacementInput>();
  for (const entry of raw) {
    const p = clampPlacement((entry ?? {}) as RawPlacement, canvas);
    if (p) out.set(p.itemId, p);
  }
  return [...out.values()];
}
