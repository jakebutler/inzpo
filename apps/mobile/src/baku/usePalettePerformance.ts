import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { runOnJS, useAnimatedReaction, useFrameCallback, useDerivedValue, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { clamp, TIMING } from './motion';
import { hostDurationFor } from './host-motion';
import { completedResultKits } from '@/lib/useResultSequence';
import { haptics } from '@/lib/haptics';

const completed = new Set<string>();
export function usePalettePerformance({ kitId, ready, enabled, photoVisible, focused, processing = true }: {
  kitId: string; ready: boolean; enabled: boolean; photoVisible: boolean; focused: boolean; processing?: boolean;
}) {
  const initialReduce = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReduce);
  const [artLoaded, setArtLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const elapsed = useSharedValue(0);
  const readyAt = useSharedValue(-1);
  const intakeElapsed = useSharedValue(0);
  const processingClock = useSharedValue(processing);
  const hadIntake = useSharedValue(!processing);
  const intakeBlend = useDerivedValue(() => !processingClock.value ? 1
    : hadIntake.value ? 1 - clamp((elapsed.value - TIMING.inhale) / .32) : 0);
  const resume = useSharedValue(true);
  const notified = useSharedValue(false);
  const finished = !enabled || reducedMotion || completed.has(kitId) || done;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);
  const complete = useCallback((celebrate: boolean) => {
    if (!mounted.current) return;
    completed.add(kitId);
    completedResultKits.add(kitId);
    setDone(true);
    if (celebrate) void haptics.soft();
  }, [kitId]);
  const skip = useCallback(() => {
    if (!ready) return;
    elapsed.set(hostDurationFor(Math.max(0, readyAt.get())));
    complete(false);
  }, [ready, elapsed, readyAt, complete]);
  const onLoaded = useCallback(() => setArtLoaded(true), []);
  useEffect(() => {
    if (processing === processingClock.get()) return;
    processingClock.set(processing);
    if (processing) elapsed.set(TIMING.inhale);
    else {
      hadIntake.set(true);
      elapsed.set(0); intakeElapsed.set(0); readyAt.set(-1);
    }
  }, [processing, processingClock, elapsed, intakeElapsed, readyAt, hadIntake]);
  useEffect(() => {
    if (ready && readyAt.get() < 0) readyAt.set(elapsed.get());
    if (ready && (reducedMotion || completed.has(kitId))) elapsed.set(hostDurationFor(Math.max(0, readyAt.get())));
  }, [ready, readyAt, elapsed, reducedMotion, kitId]);
  const clock = useFrameCallback(({ timeSincePreviousFrame }) => {
    if (resume.get()) { resume.set(false); return; }
    const delta = Math.min(timeSincePreviousFrame ?? 0, 64) / 1000;
    intakeElapsed.set(intakeElapsed.get() + delta);
    if (processingClock.get()) elapsed.set(elapsed.get() + delta);
  }, false);
  useEffect(() => {
    const update = (state: string | null) => {
      resume.set(true);
      clock.setActive(!finished && focused && photoVisible && artLoaded && state === 'active');
    };
    update(AppState.currentState);
    const sub = AppState.addEventListener('change', update);
    return () => { clock.setActive(false); sub.remove(); };
  }, [finished, focused, photoVisible, artLoaded, clock, resume]);
  useAnimatedReaction(() => readyAt.value >= 0 && elapsed.value >= hostDurationFor(readyAt.value), end => {
    if (end && !notified.get()) { notified.set(true); runOnJS(complete)(true); }
  }, [complete]);
  return { elapsed, readyAt, intakeElapsed, intakeBlend, finished, reducedMotion, skip, onLoaded };
}
export type PalettePerformance = ReturnType<typeof usePalettePerformance>;
