import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { runOnJS, useAnimatedReaction, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { durationFor } from './motion';
import { completedResultKits } from '@/lib/useResultSequence';
import { haptics } from '@/lib/haptics';

const completed = new Set<string>();
export function usePalettePerformance({ kitId, ready, enabled, photoVisible, focused }: {
  kitId: string; ready: boolean; enabled: boolean; photoVisible: boolean; focused: boolean;
}) {
  const initialReduce = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReduce);
  const [artLoaded, setArtLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const elapsed = useSharedValue(0);
  const readyAt = useSharedValue(-1);
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
    elapsed.set(durationFor(Math.max(0, readyAt.get())));
    complete(false);
  }, [ready, elapsed, readyAt, complete]);
  const onLoaded = useCallback(() => setArtLoaded(true), []);
  useEffect(() => {
    if (ready && readyAt.get() < 0) readyAt.set(elapsed.get());
  }, [ready, readyAt, elapsed]);
  const clock = useFrameCallback(({ timeSincePreviousFrame }) => {
    if (resume.get()) { resume.set(false); return; }
    elapsed.set(elapsed.get() + Math.min(timeSincePreviousFrame ?? 0, 64) / 1000);
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
  useAnimatedReaction(() => readyAt.value >= 0 && elapsed.value >= durationFor(readyAt.value), end => {
    if (end && !notified.get()) { notified.set(true); runOnJS(complete)(true); }
  }, [complete]);
  return { elapsed, readyAt, finished, reducedMotion, skip, onLoaded };
}
export type PalettePerformance = ReturnType<typeof usePalettePerformance>;
