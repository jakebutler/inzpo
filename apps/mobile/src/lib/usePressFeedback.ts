import { useEffect } from 'react';
import { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BUTTON_PRESS_SCALE, ENTER_SPRING, FADE_TIMING, TAP_TIMING } from '@/theme/motion';

export function usePressFeedback({
  pressScale = BUTTON_PRESS_SCALE, disabled = false, disabledOpacity = 0.4, onPressIn, pressOffset,
}: { pressScale?: number; disabled?: boolean; disabledOpacity?: number; onPressIn?: () => void; pressOffset?: number }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (disabled) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.set(1);
      opacity.set(1);
    }
    return () => { cancelAnimation(scale); cancelAnimation(opacity); };
  }, [disabled, scale, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? disabledOpacity : opacity.value,
    transform: pressOffset === undefined ? [{ scale: reducedMotion ? 1 : scale.value }]
      : [{ translateY: reducedMotion ? 0 : pressOffset }, { scale: reducedMotion ? 1 : scale.value }],
  }));

  return {
    animatedStyle,
    onPressIn: () => {
      if (disabled) return;
      if (reducedMotion) opacity.set(withTiming(0.72, FADE_TIMING));
      else scale.set(withTiming(pressScale, TAP_TIMING));
      onPressIn?.();
    },
    onPressOut: () => {
      if (reducedMotion) opacity.set(withTiming(1, FADE_TIMING));
      else scale.set(withSpring(1, ENTER_SPRING));
    },
  };
}
