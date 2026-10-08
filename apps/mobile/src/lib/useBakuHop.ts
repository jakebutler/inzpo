import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import type { BakuPose } from '@/components/Baku';
import { ENTER_SPRING, HOP_TIMELINE, TAP_TIMING } from '@/theme/motion';
import type { BakuJiggle } from './baku-pupils';

type BaseMotion = {
  bakuY: SharedValue<number>; bakuScaleX: SharedValue<number>;
  bakuScaleY: SharedValue<number>; bakuOpacity: SharedValue<number>;
};

export function useBakuHop({ kitId, base, jiggle }: { kitId: string; base: BaseMotion; jiggle: BakuJiggle }) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const shadowScale = useSharedValue(1);
  const values = useMemo(() => ({ translateY, scaleX, scaleY, shadowScale }), [translateY, scaleX, scaleY, shadowScale]);
  const [feedback, setFeedback] = useState<{ kitId: string; pose: BakuPose } | null>(null);
  const pose = feedback?.kitId === kitId ? feedback.pose : null;
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTransforms = useCallback(() => {
    Object.values(values).forEach((value) => cancelAnimation(value));
    translateY.set(0);
    scaleX.set(1);
    scaleY.set(1);
    shadowScale.set(1);
  }, [values, translateY, scaleX, scaleY, shadowScale]);
  const cancel = useCallback(() => {
    if (hold.current !== null) clearTimeout(hold.current);
    hold.current = null;
    resetTransforms();
  }, [resetTransforms]);
  useEffect(() => { cancel(); return cancel; }, [kitId, cancel]);
  useEffect(() => { if (reducedMotion) resetTransforms(); }, [reducedMotion, resetTransforms]);

  const onSaved = useCallback(() => {
    cancel();
    setFeedback({ kitId, pose: 'success' });
    hold.current = setTimeout(() => { hold.current = null; setFeedback({ kitId, pose: 'idle' }); }, HOP_TIMELINE.successHoldMs);
    if (reducedMotion) return;
    const anticipation = { ...TAP_TIMING, duration: HOP_TIMELINE.anticipationMs };
    const takeoff = { ...TAP_TIMING, duration: HOP_TIMELINE.takeoffMs };
    scaleX.set(withTiming(HOP_TIMELINE.anticipationScaleX, anticipation));
    // Phase callbacks run on the UI thread, so takeoff and landing stay aligned
    // with the squash even when JS is busy. The only JS timer holds the pose.
    scaleY.set(withTiming(HOP_TIMELINE.anticipationScaleY, anticipation, (squashed) => {
      if (!squashed) return;
      scaleX.set(withTiming(1, takeoff));
      scaleY.set(withTiming(HOP_TIMELINE.stretchScaleY, takeoff));
      shadowScale.set(withTiming(HOP_TIMELINE.peakShadowScale, takeoff));
      translateY.set(withTiming(HOP_TIMELINE.peakY, takeoff, (atPeak) => {
        if (!atPeak) return;
        translateY.set(withSpring(0, ENTER_SPRING));
        shadowScale.set(withSpring(1, ENTER_SPRING));
        scaleY.set(withSequence(
          withTiming(HOP_TIMELINE.stretchScaleY, { duration: HOP_TIMELINE.flightMs }, (landed) => {
            if (!landed) return;
            // Enter springs can oscillate beyond their nominal 320ms beat.
            // Finish the sub-point residual at contact, before the foot squash.
            translateY.set(0);
            shadowScale.set(1);
            jiggle({ x: 0, y: 1 });
          }),
          withTiming(HOP_TIMELINE.landingScaleY, { ...TAP_TIMING, duration: HOP_TIMELINE.landingMs }),
          withSpring(1, ENTER_SPRING),
        ));
      }));
    }));
  }, [cancel, reducedMotion, scaleX, scaleY, shadowScale, translateY, jiggle, kitId]);
  const onSaveError = useCallback(() => { cancel(); setFeedback({ kitId, pose: 'errorBrief' }); }, [cancel, kitId]);
  const { bakuY, bakuScaleX, bakuScaleY, bakuOpacity } = base;
  const bakuStyle = useAnimatedStyle(() => ({
    opacity: bakuOpacity.value,
    transform: [
      { translateY: bakuY.value + translateY.value },
      { scaleX: bakuScaleX.value * scaleX.value },
      { scaleY: bakuScaleY.value * scaleY.value },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: shadowScale.value }, { scaleY: shadowScale.value }] }));
  return { pose, onSaved, onSaveError, bakuStyle, shadowStyle, values };
}
