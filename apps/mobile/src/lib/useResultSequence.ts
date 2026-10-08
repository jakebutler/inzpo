import { COLOR_ROLES } from '@inzpo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ENTER_SPRING, FADE_TIMING, RESULT_TIMELINE, TAP_TIMING, resultSequenceBeats } from '@/theme/motion';
import { haptics } from './haptics';

// Completed heroes are remembered for revisits during this app session.
export const completedResultKits = new Set<string>();

export type BandMotion = { opacity: SharedValue<number>; translateY: SharedValue<number> };

function useBandMotion(): BandMotion {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(RESULT_TIMELINE.bandRise as number);
  return useMemo(() => ({ opacity, translateY }), [opacity, translateY]);
}

export function useResultSequence({ kitId, ready }: { kitId: string; ready: boolean }) {
  const reducedMotion = useReducedMotion();
  // Fixed hook order, matching COLOR_ROLES. No hooks in a map or variable loop.
  const primary = useBandMotion();
  const secondary = useBandMotion();
  const accent = useBandMotion();
  const background = useBandMotion();
  const surface = useBandMotion();
  const text = useBandMotion();
  const bandValues = useMemo(() => [primary, secondary, accent, background, surface, text],
    [primary, secondary, accent, background, surface, text]);
  // One shared opacity animation for all six reduced-motion bands.
  const bands = useMemo(() => reducedMotion
    ? bandValues.map((band) => ({ ...band, opacity: primary.opacity })) : bandValues,
  [bandValues, primary.opacity, reducedMotion]);
  const bakuY = useSharedValue(0);
  const bakuScaleX = useSharedValue(1);
  const bakuScaleY = useSharedValue(1);
  const bakuOpacity = useSharedValue(1);
  const markerScale = useSharedValue(RESULT_TIMELINE.markerStartScale as number);
  const markerOpacity = useSharedValue(0);
  const briefY = useSharedValue(RESULT_TIMELINE.briefRise as number);
  const briefOpacity = useSharedValue(0);
  const values = useMemo(() => [
    ...bandValues.flatMap((band) => [band.opacity, band.translateY]),
    bakuY, bakuScaleX, bakuScaleY, bakuOpacity, markerScale, markerOpacity, briefY, briefOpacity,
  ], [bandValues, bakuY, bakuScaleX, bakuScaleY, bakuOpacity, markerScale, markerOpacity, briefY, briefOpacity]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scope = useRef({ kitId: '', started: false, skipped: false, landed: false });
  const [revealed, setRevealed] = useState({ kitId, count: completedResultKits.has(kitId) ? 6 : 0 });
  const [finishedKit, setFinishedKit] = useState<string | null>(null);

  const cancel = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    values.forEach((value) => cancelAnimation(value));
  }, [values]);

  const setEndValues = useCallback(() => {
    setRevealed({ kitId, count: 6 });
    bands.forEach((band) => { band.opacity.set(1); band.translateY.set(0); });
    bakuY.set(0);
    bakuScaleX.set(1);
    bakuScaleY.set(1);
    bakuOpacity.set(1);
    markerScale.set(1);
    markerOpacity.set(1);
    briefY.set(0);
    briefOpacity.set(1);
  }, [kitId, bands, bakuY, bakuScaleX, bakuScaleY, bakuOpacity, markerScale, markerOpacity, briefY, briefOpacity]);

  const skipToEnd = useCallback(() => {
    if (!ready || scope.current.kitId !== kitId || !scope.current.started
      || scope.current.skipped || finishedKit === kitId) return;
    // Policy: skipping before the landing cancels its soft haptic. Skipping
    // after landing never adds another. Only an active hero can be skipped.
    scope.current.skipped = true;
    cancel();
    setEndValues();
    completedResultKits.add(kitId);
    setFinishedKit(kitId);
  }, [cancel, setEndValues, kitId, ready, finishedKit]);

  useEffect(() => {
    if (scope.current.kitId !== kitId) {
      scope.current = { kitId, started: false, skipped: false, landed: false };
      setFinishedKit(null);
      setRevealed({ kitId, count: completedResultKits.has(kitId) ? 6 : 0 });
      bands.forEach((band) => {
        band.opacity.set(0);
        band.translateY.set(reducedMotion ? 0 : RESULT_TIMELINE.bandRise);
      });
      briefOpacity.set(0);
      briefY.set(reducedMotion ? 0 : RESULT_TIMELINE.briefRise);
      markerOpacity.set(0);
      markerScale.set(reducedMotion ? 1 : RESULT_TIMELINE.markerStartScale);
    }
    bakuY.set(0);
    bakuScaleX.set(1);
    bakuScaleY.set(1);
    bakuOpacity.set(1);

    if (scope.current.skipped) {
      setEndValues();
      return cancel;
    }
    if (!ready) {
      if (!reducedMotion) {
        const halfBob = { duration: RESULT_TIMELINE.chewingCycleMs / 2, easing: Easing.inOut(Easing.sin) };
        bakuY.set(-RESULT_TIMELINE.chewingAmplitude);
        bakuY.set(withRepeat(withTiming(RESULT_TIMELINE.chewingAmplitude, halfBob), -1, true));
      }
      return cancel;
    }
    // Refreshing a title or signed photo URL must not replay the hero.
    if (scope.current.started || completedResultKits.has(kitId)) {
      setEndValues();
      completedResultKits.add(kitId);
      setFinishedKit(kitId);
      return cancel;
    }
    scope.current.started = true;
    setRevealed({ kitId, count: reducedMotion ? 6 : 0 });
    const beats = resultSequenceBeats(COLOR_ROLES.length, reducedMotion);
    bands.forEach((band) => {
      band.opacity.set(0);
      band.translateY.set(reducedMotion ? 0 : RESULT_TIMELINE.bandRise);
    });
    markerOpacity.set(0);
    markerScale.set(reducedMotion ? 1 : RESULT_TIMELINE.markerStartScale);
    briefOpacity.set(0);
    briefY.set(reducedMotion ? 0 : RESULT_TIMELINE.briefRise);
    if (reducedMotion) {
      bakuOpacity.set(0);
      bakuOpacity.set(withTiming(1, FADE_TIMING));
      primary.opacity.set(withTiming(1, FADE_TIMING));
    } else {
      const swallowTiming = { ...TAP_TIMING, duration: RESULT_TIMELINE.swallowMs };
      bakuScaleX.set(withSequence(withTiming(RESULT_TIMELINE.swallowScaleX, swallowTiming), withSpring(1, ENTER_SPRING)));
      bakuScaleY.set(withSequence(withTiming(RESULT_TIMELINE.swallowScaleY, swallowTiming), withSpring(1, ENTER_SPRING)));
    }
    bands.forEach((band, index) => {
      if (reducedMotion) return;
      const delay = RESULT_TIMELINE.bandStartMs + index * RESULT_TIMELINE.bandStaggerMs;
      timers.current.push(setTimeout(() => setRevealed({ kitId, count: index + 1 }), delay));
      band.opacity.set(withDelay(delay, withTiming(1, FADE_TIMING)));
      band.translateY.set(withDelay(delay, withSpring(0, ENTER_SPRING)));
    });
    markerOpacity.set(withDelay(beats.markersMs, withTiming(1, FADE_TIMING)));
    markerScale.set(reducedMotion ? 1 : withDelay(beats.markersMs, withSpring(1, ENTER_SPRING)));
    const briefTiming = reducedMotion ? FADE_TIMING : { ...FADE_TIMING, duration: RESULT_TIMELINE.briefFadeMs };
    briefOpacity.set(withDelay(beats.briefMs, withTiming(1, briefTiming)));
    briefY.set(reducedMotion ? 0 : withDelay(beats.briefMs, withTiming(0, briefTiming)));
    // UI-thread animations carry transforms/fades; JS timers deliver stripe
    // reveals, haptic and buttons. All are cancelled on skip/unmount.
    timers.current.push(setTimeout(() => {
      if (scope.current.skipped || scope.current.landed) return;
      scope.current.landed = true;
      void haptics.soft();
    }, beats.landingMs));
    timers.current.push(setTimeout(() => {
      completedResultKits.add(kitId);
      setFinishedKit(kitId);
    }, beats.interactiveMs));
    return () => {
      cancel();
      // React Strict Mode may tear down and restart effects before the first
      // frame. Resume an interrupted pre-landing run instead of marking it done.
      if (!scope.current.landed && !scope.current.skipped) scope.current.started = false;
    };
  }, [kitId, ready, reducedMotion, bands, primary.opacity, bakuY, bakuScaleX, bakuScaleY, bakuOpacity,
    markerScale, markerOpacity, briefY, briefOpacity, cancel, setEndValues]);

  const bakuStyle = useAnimatedStyle(() => ({
    opacity: bakuOpacity.value,
    transform: [{ translateY: bakuY.value }, { scaleX: bakuScaleX.value }, { scaleY: bakuScaleY.value }],
  }));
  const markerStyle = useAnimatedStyle(() => ({ opacity: markerOpacity.value, transform: [{ scale: markerScale.value }] }));
  const briefStyle = useAnimatedStyle(() => ({ opacity: briefOpacity.value, transform: [{ translateY: briefY.value }] }));

  return {
    revealedBands: revealed.kitId === kitId ? revealed.count : completedResultKits.has(kitId) ? 6 : 0,
    bands, bakuStyle, markerStyle, briefStyle, skipToEnd, reducedMotion,
    interactive: ready && finishedKit === kitId,
    values: { bakuY, bakuScaleX, bakuScaleY, bakuOpacity, markerScale, markerOpacity, briefY, briefOpacity },
  };
}
