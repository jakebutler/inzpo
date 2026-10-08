/** The measured bar includes safe-area padding; 24px clears the 16px fade. */
export const SAVE_BAR_FADE_HEIGHT = "16px";
export const SAVE_BAR_HEIGHT_VAR = "--save-bar-height";
/** SSR / pre-measure fallback approximates the bar so content does not jump once measured. */
export const SAVE_BAR_FALLBACK_HEIGHT = "calc(5rem + env(safe-area-inset-bottom, 0px))";
export const SAVE_BAR_PAD = `calc(var(${SAVE_BAR_HEIGHT_VAR}, ${SAVE_BAR_FALLBACK_HEIGHT}) + 24px)`;

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
