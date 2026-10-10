import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { inhaleRibbon, type Emitter, type Point } from './transport';
import type { PalettePerformance } from './usePalettePerformance';

type Sample = { color: string; source: Point };
function Ribbon({ sample, index, baku, performance }: {
  sample: Sample; index: number; baku: Emitter; performance: PalettePerformance;
}) {
  const ribbon = useDerivedValue(() => inhaleRibbon(performance.elapsed.value,
    performance.readyAt.value < 0 ? null : performance.readyAt.value, sample.source, baku, index));
  const path = useDerivedValue(() => {
    const next = Skia.PathBuilder.Make();
    const points = ribbon.value.points;
    if (points.length) {
      next.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) next.lineTo(points[i].x, points[i].y);
      next.close();
    }
    return next.detach();
  });
  const opacity = useDerivedValue(() => ribbon.value.opacity);
  return <Path path={path} color={sample.color} opacity={opacity} />;
}

export function ColorInhale({ samples, width, height, baku, performance }: {
  samples: Sample[]; width: number; height: number; baku: Emitter; performance: PalettePerformance;
}) {
  return <Canvas accessible={false} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 12 }}>
    {samples.map((sample, index) => <Ribbon key={index} sample={sample} index={index} baku={baku} performance={performance} />)}
  </Canvas>;
}
