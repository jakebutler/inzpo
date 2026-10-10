import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { intakeDust } from './host-motion';
import type { Emitter, Point } from './transport';
import type { PalettePerformance } from './usePalettePerformance';

function Puff({ index, source, baku, performance }: {
  index: number; source: Point; baku: Emitter; performance: PalettePerformance;
}) {
  const dust = useDerivedValue(() => intakeDust(performance.intakeElapsed.value, performance.intakeBlend.value,
    index, source, baku, performance.elapsed.value, performance.readyAt.value));
  const cx = useDerivedValue(() => dust.value.x), cy = useDerivedValue(() => dust.value.y);
  const radius = useDerivedValue(() => dust.value.radius), opacity = useDerivedValue(() => dust.value.opacity);
  return <Circle cx={cx} cy={cy} r={radius} opacity={opacity} color={index % 2 ? '#AD9982' : '#D2BDA2'}>
    <BlurMask blur={index % 3 === 0 ? 2.5 : .6} style="normal" />
  </Circle>;
}

export function DustIntake({ width, height, source, baku, performance }: {
  width: number; height: number; source: Point; baku: Emitter; performance: PalettePerformance;
}) {
  return <Canvas testID="baku-intake-dust" accessible={false} pointerEvents="none"
    style={{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 12 }}>
    <DustCloud source={source} baku={baku} performance={performance} />
  </Canvas>;
}

/** Also rendered through the real Skia scene graph in the visual check. */
export function DustCloud({ source, baku, performance }: { source: Point; baku: Emitter; performance: PalettePerformance }) {
  return <>{Array.from({ length: 18 }, (_, index) => <Puff key={index} index={index} source={source} baku={baku} performance={performance} />)}</>;
}
