/**
 * Space below Baku / chips / brief so the fixed save bar never covers them.
 * Bar is ~4.75rem (h-14 + padding); a 3rem fade sits above it as an overlay.
 */
export const SAVE_BAR_PAD = "calc(8.5rem + env(safe-area-inset-bottom, 0px))";
export const SNAP_BAR_HEIGHT = "calc(8.5rem + env(safe-area-inset-bottom, 0px))";
/** Snap bar height plus 16px so the second card title clears the bar. */
export const SNAP_SCROLL_PAD = "calc(8.5rem + 1rem + env(safe-area-inset-bottom, 0px))";
export const BAR_FADE = "linear-gradient(to bottom, transparent, var(--background))";
export const PHOTO_MAX_SVH = "45svh";
export {
  PHOTO_FOLD_PX,
  PHOTO_FOLD_CSS,
  PHOTO_FOLD_MIN_PX,
  PHOTO_FOLD_RESERVE_PX,
  PHOTO_FOLD_FLOOR_VH,
  BRIEF_SLOT_MIN_PX,
} from "@/lib/brand";
