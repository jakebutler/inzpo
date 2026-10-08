/** Neutral surfaces. Vermilion is the only accent on paper screens. */
export const PAPER = "#F3EEE4";
export const INK = "#1C1B19";
export const VERMILION = "#C9341F";

export const BAND_H_RESULT = 40;
export const BAND_H_EDITOR = 56;
export const BAND_STAGGER_S = 0.06;
export const PIN_SIZE = 22;
export const PIN_INNER_RING_PX = 2;
export const PIN_OUTER_RING_PX = 1.5;
export const PIN_SHADOW = "0 1px 2px rgba(0,0,0,.25)";
export const CHIP_SWATCH_PX = 20;
export const PIN_HAIRLINE_S = 0.4;
export const PIN_LEADER_X = 16;
export const PHOTO_FOLD_PX = 337;
export const PHOTO_FOLD_MIN_PX = 200;
export const PHOTO_FOLD_RESERVE_PX = 418;
export const PHOTO_FOLD_CSS = `clamp(${PHOTO_FOLD_MIN_PX}px, 100svh - ${PHOTO_FOLD_RESERVE_PX}px, ${PHOTO_FOLD_PX}px)`;
export const LOUPE_PX = 96;
export const LOUPE_ZOOM = 3;
export const LOUPE_OFFSET_PX = 64;
export const PHOTO_BACK_PX = 44;

/** Photo frame height for a viewport. 249px at 667, 337px at 844. */
export function photoFoldHeight(vh: number): number {
  if (!Number.isFinite(vh) || vh <= 0) return PHOTO_FOLD_PX;
  return Math.min(PHOTO_FOLD_PX, Math.max(PHOTO_FOLD_MIN_PX, vh - PHOTO_FOLD_RESERVE_PX));
}

/** 22px swatch fill, 2px paper inner ring, 1.5px ink outer ring, contact shadow. */
export function pinDiscStyle(hex: string): {
  width: number;
  height: number;
  backgroundColor: string;
  border: string;
  outline: string;
  outlineOffset: number;
  boxShadow: string;
  boxSizing: "border-box";
  borderRadius: number;
} {
  return {
    width: PIN_SIZE,
    height: PIN_SIZE,
    backgroundColor: hex,
    border: `${PIN_INNER_RING_PX}px solid ${PAPER}`,
    outline: `${PIN_OUTER_RING_PX}px solid ${INK}`,
    outlineOffset: 0,
    boxShadow: PIN_SHADOW,
    boxSizing: "border-box",
    borderRadius: 9999,
  };
}
