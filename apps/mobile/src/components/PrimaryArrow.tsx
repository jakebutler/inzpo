import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import type { SamplePoint } from '@/lib/result-pins';
import { fonts, INK } from '@/theme/tokens';

export function PrimaryArrow({ width, height, end, hue, progress, reducedMotion }: {
  width: number; height: number; end: SamplePoint; hue: string;
  progress: SharedValue<number>; reducedMotion: boolean;
}) {
  const [captionWidth, setCaptionWidth] = useState(75);
  const captionTop = end.y + 16;
  const start = { x: 16 + captionWidth + 6, y: captionTop + 12 };
  const control = { x: end.x - 28, y: end.y - 20 };
  const path = Skia.Path.MakeFromSVGString(`M${start.x} ${start.y} C${start.x + 12} ${start.y - 24} ${control.x} ${control.y} ${end.x} ${end.y}`)!;
  const angle = Math.atan2(end.y - control.y, end.x - control.x);
  const head = (spread: number, length: number) => ({ x: end.x - length * Math.cos(angle + spread), y: end.y - length * Math.sin(angle + spread) });
  const upper = head(-0.5, 14), lower = head(0.55, 13);
  const draw = useDerivedValue(() => reducedMotion ? 1 : progress.value);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height, zIndex: 20 }, fade]}>
    <Canvas accessible={false} style={StyleSheet.absoluteFill}>
      <Path path={path} end={draw} color={INK} style="stroke" strokeWidth={2.6} strokeCap="round" />
      <Path path={Skia.Path.MakeFromSVGString(`M${end.x} ${end.y} L${upper.x} ${upper.y}`)!}
        end={draw} color={INK} style="stroke" strokeWidth={2.2} strokeCap="round" />
      <Path path={Skia.Path.MakeFromSVGString(`M${end.x} ${end.y} L${lower.x} ${lower.y}`)!}
        end={draw} color={INK} style="stroke" strokeWidth={2.9} strokeCap="round" />
    </Canvas>
    <View testID="primary-caption" onLayout={(event) => setCaptionWidth(event.nativeEvent.layout.width)}
      style={{ position: 'absolute', left: 16, top: captionTop, maxWidth: width - 32 }}>
      <Text allowFontScaling style={{ fontFamily: fonts.hand, fontSize: 17, color: INK }}>{`This ${hue}.`}</Text>
    </View>
  </Animated.View>;
}
