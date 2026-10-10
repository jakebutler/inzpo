import type { RoleColors } from '@inzpo/shared';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { balloonFlight, flightSeed } from './host-motion';
import { KnitBaku } from './KnitBaku';
import type { Emitter } from './transport';
import type { PalettePerformance } from './usePalettePerformance';

/** One mesh stays mounted from the first intake breath to the settled corner. */
export function FlyingBaku({ id, origin, target, bounds, roles, performance, settled }: {
  id: string; origin: Emitter; target: Emitter; bounds: { width: number; height: number };
  roles: RoleColors; performance: PalettePerformance; settled: boolean;
}) {
  const seed = flightSeed(id);
  const motion = useAnimatedStyle(() => {
    const flight = settled ? { x: target.x + target.width / 2, y: target.y + target.width / 3,
      scale: target.width / origin.width, rotation: 0 }
      : balloonFlight(performance.elapsed.value, performance.readyAt.value, origin, target, seed, bounds);
    return { transform: [{ translateX: flight.x - origin.width / 2 }, { translateY: flight.y - origin.width / 3 }, { rotate: `${flight.rotation}deg` }, { scale: flight.scale }] };
  });
  return <Animated.View testID="baku-host" pointerEvents="none"
    style={[{ position: 'absolute', left: 0, top: 0, width: origin.width, height: origin.width * 2 / 3, zIndex: 20 }, motion]}>
    <KnitBaku width={origin.width} elapsed={performance.elapsed} readyAt={performance.readyAt}
      intakeElapsed={performance.intakeElapsed} intakeBlend={performance.intakeBlend}
      roles={roles} onLoaded={performance.onLoaded} />
  </Animated.View>;
}
