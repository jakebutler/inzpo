import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import type { SamplePoint } from '@/lib/result-pins';
import { fonts, INK } from '@/theme/tokens';

export function PrimaryArrow({ width, height, start, end, hue, progress, reducedMotion }: {
  width: number; height: number; start: SamplePoint; end: SamplePoint; hue: string;
  progress: SharedValue<number>; reducedMotion: boolean;
}) {
  const bowX = (end.x - start.x) / 89;
  const bowY = (start.y - end.y) / 153;
  const path = Skia.Path.MakeFromSVGString(`M${start.x} ${start.y} C${start.x - 8 * bowX} ${start.y - 34 * bowY} ${start.x - 3 * bowX} ${start.y - 73 * bowY} ${start.x + 10 * bowX} ${start.y - 105 * bowY} C${start.x + 21 * bowX} ${start.y - 134 * bowY} ${start.x + 33 * bowX} ${start.y - 168 * bowY} ${end.x} ${end.y}`)!;
  const draw = useDerivedValue(() => reducedMotion ? 1 : progress.value);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 20 }, fade]}>
    <Canvas accessible={false} style={StyleSheet.absoluteFill}>
      <Path path={path} end={draw} color={INK} style="stroke" strokeWidth={2.6} strokeCap="round" />
      <Path path={Skia.Path.MakeFromSVGString(`M${end.x} ${end.y} Q${end.x - 9} ${end.y - 5} ${end.x - 14} ${end.y - 8}`)!}
        end={draw} color={INK} style="stroke" strokeWidth={2.2} strokeCap="round" />
      <Path path={Skia.Path.MakeFromSVGString(`M${end.x} ${end.y} Q${end.x - 4} ${end.y + 6} ${end.x - 8} ${end.y + 12}`)!}
        end={draw} color={INK} style="stroke" strokeWidth={2.9} strokeCap="round" />
    </Canvas>
    <View style={{ position: 'absolute', left: 16, top: end.y + 3, maxWidth: Math.max(70, end.x - 20) }}>
      <Text allowFontScaling style={{ fontFamily: fonts.hand, fontSize: 17, color: INK }}>{`This ${hue}.`}</Text>
    </View>
  </Animated.View>;
}
