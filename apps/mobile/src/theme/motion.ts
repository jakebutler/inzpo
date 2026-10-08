import { Easing, ReduceMotion } from 'react-native-reanimated';

export const TAP_TIMING = { duration: 120, easing: Easing.out(Easing.cubic) } as const;
// Explicit fades survive the system reduced-motion setting. Transforms are
// replaced by fades at the call site, rather than silently becoming instant.
export const FADE_TIMING = { duration: 150, easing: Easing.linear, reduceMotion: ReduceMotion.Never } as const;
export const ENTER_SPRING = { damping: 18, stiffness: 220, mass: 1 } as const;
export const BAND_STAGGER_MS = 60;
export const SHEET_SPRING = { damping: 30, stiffness: 300, reduceMotion: ReduceMotion.Never } as const;
export const REDUCED_SHEET_SPRING = { damping: 40, stiffness: 400, reduceMotion: ReduceMotion.Never } as const;
export const BUTTON_PRESS_SCALE = 0.96;
export const SHUTTER_PRESS_SCALE = 0.92;

// All result beats live here. settleMs is the designer's nominal spring
// landing beat, not Reanimated's much later near-zero-energy completion.
export const RESULT_TIMELINE = {
  swallowMs: TAP_TIMING.duration,
  swallowScaleX: 1.04,
  swallowScaleY: 0.94,
  bandStartMs: 120,
  bandStaggerMs: BAND_STAGGER_MS,
  stripeWipeMs: 180,
  bandRise: 24,
  bandSettleMs: 320,
  markersAfterLandingMs: 80,
  markerStartScale: 0.6,
  briefAfterMarkersMs: 120,
  briefFadeMs: 240,
  briefRise: 8,
  chewingCycleMs: 900,
  chewingAmplitude: 2,
} as const;

export function resultSequenceBeats(bandCount: number, reducedMotion: boolean) {
  const landingMs = reducedMotion ? FADE_TIMING.duration
    : RESULT_TIMELINE.bandStartMs + RESULT_TIMELINE.bandStaggerMs * (bandCount - 1) + RESULT_TIMELINE.bandSettleMs;
  const markersMs = reducedMotion ? 0 : landingMs + RESULT_TIMELINE.markersAfterLandingMs;
  const briefMs = reducedMotion ? 0 : markersMs + RESULT_TIMELINE.briefAfterMarkersMs;
  return { landingMs, markersMs, briefMs, interactiveMs: reducedMotion ? landingMs : briefMs };
}
