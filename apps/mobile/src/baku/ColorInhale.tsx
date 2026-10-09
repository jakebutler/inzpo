import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { clamp, deform, poseAt, SNOUT } from './motion';
import type { PalettePerformance } from './usePalettePerformance';

/** A fleck leaves its measured photo sample and follows the moving nostril. */
export function ColorInhale({ color, source, baku, index, performance }: {
  color: string; source: { x: number; y: number }; baku: { x: number; y: number; width: number }; index: number; performance: PalettePerformance;
}) {
  const motion = useAnimatedStyle(() => {
    const time = performance.elapsed.value;
    const progress = clamp((time - .22 - index * .08) / .9);
    const point = deform(SNOUT.x, SNOUT.y, poseAt(time, Math.max(0, performance.readyAt.value)));
    const x = baku.x + point.x * baku.width, y = baku.y + point.y * baku.width * 2 / 3;
    return { opacity: progress > 0 && progress < 1 ? Math.sin(progress * Math.PI) : 0,
      transform: [{ translateX: source.x + (x - source.x) * progress - 4 },
        { translateY: source.y + (y - source.y) * progress - Math.sin(progress * Math.PI) * 22 - 4 },
        { scale: 1 - progress * .6 }] };
  });
  return <Animated.View accessible={false} pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0,
    width: 8, height: 8, borderRadius: 4, backgroundColor: color, zIndex: 12 }, motion]} />;
}
