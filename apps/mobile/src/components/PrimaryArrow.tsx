import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import type { SamplePoint } from '@/lib/result-pins';
import { CANVAS, fonts, INK } from '@/theme/tokens';

export function primaryCaptionLeft(photoLeft: number, textWidth: number) {
  return Math.max(4, Math.min(16, photoLeft - textWidth - 2));
}

export function PrimaryArrow({ width, height, start, end, hue, progress, reducedMotion, photoLeft }: {
  width: number; height: number; start: SamplePoint; end: SamplePoint; hue: string;
  progress: SharedValue<number>; reducedMotion: boolean;
  photoLeft: number;
}) {
  const [captionWidth, setCaptionWidth] = useState(80);
  const captionLeft = primaryCaptionLeft(photoLeft, captionWidth);
  const captionTop = end.y + 16;
  const control = { x: end.x - 28, y: end.y - 20 };
  const path = Skia.Path.MakeFromSVGString(`M${start.x} ${start.y} C${start.x - 28} ${end.y - 20} ${control.x} ${control.y} ${end.x} ${end.y}`)!;
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
    <View testID="primary-caption"
      style={{ position: 'absolute', left: captionLeft, top: captionTop, width: width - captionLeft - 16 }}>
      <Text allowFontScaling onTextLayout={(event) => {
        setCaptionWidth(Math.max(0, ...event.nativeEvent.lines.map((line) => line.width)));
      }} style={{ alignSelf: 'flex-start', fontFamily: fonts.hand, fontSize: 17, lineHeight: 26, paddingRight: 2, color: INK,
        // Extend the canvas behind long captions when they outgrow the photo gutter.
        backgroundColor: captionLeft + captionWidth + 2 > photoLeft ? CANVAS : 'transparent' }}>{`This ${hue}.`}</Text>
    </View>
  </Animated.View>;
}
