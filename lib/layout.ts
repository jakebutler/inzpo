/**
 * Space below Baku / chips / brief so the fixed save bar never covers them.
 * Keep the fallback for SSR; the measured bar includes its safe-area padding.
 * Reserve the fade and a 1rem gap as well so neither overlays the last line.
 */
export const SAVE_BAR_FADE_HEIGHT = "3rem";
export const SAVE_BAR_HEIGHT_VAR = "--save-bar-height";
export const SAVE_BAR_PAD = `max(calc(8.5rem + env(safe-area-inset-bottom, 0px)), calc(var(${SAVE_BAR_HEIGHT_VAR}, 0px) + ${SAVE_BAR_FADE_HEIGHT} + 1rem))`;

/** Share the fixed bar's actual height with its sibling content, locally. */
export function observeSaveBarHeight(bar: HTMLElement): () => void {
  const scope = bar.parentElement;
  if (!scope) return () => {};
  const previous = scope.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR);
  const update = () => {
    scope.style.setProperty(SAVE_BAR_HEIGHT_VAR, `${bar.getBoundingClientRect().height}px`);
  };
  update();
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
  observer?.observe(bar);
  return () => {
    observer?.disconnect();
    if (previous) scope.style.setProperty(SAVE_BAR_HEIGHT_VAR, previous);
    else scope.style.removeProperty(SAVE_BAR_HEIGHT_VAR);
  };
}
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
