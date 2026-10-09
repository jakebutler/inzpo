import { useCallback, useEffect } from 'react';
import { cancelAnimation, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { PUPIL_SPRING } from '@/theme/motion';
import { BAKU_SPRITE_PIXELS } from './baku-eyes';
import { PUPIL_IMPULSE_PT, type PupilVector } from './baku-pupils';

export function useBakuPupils(size = 96) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue<PupilVector>({ x: 0, y: 0 });
  const reset = useCallback(() => {
    'worklet';
    cancelAnimation(offset);
    offset.set({ x: 0, y: 0 });
  }, [offset]);
  const jiggle = useCallback((impulse: PupilVector) => {
    'worklet';
    if (reducedMotion) { reset(); return; }
    const length = Math.hypot(impulse.x, impulse.y);
    if (length === 0) return;
    cancelAnimation(offset);
    const pixels = PUPIL_IMPULSE_PT * BAKU_SPRITE_PIXELS / size;
    offset.set({ x: impulse.x / length * pixels, y: impulse.y / length * pixels });
    offset.set(withSpring({ x: 0, y: 0 }, PUPIL_SPRING));
  }, [offset, reducedMotion, reset, size]);
  useEffect(() => { reset(); return reset; }, [reset, reducedMotion]);
  return { offset, jiggle, reset };
}
