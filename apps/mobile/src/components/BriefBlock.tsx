import { type BriefJob } from '@inzpo/shared';
import { Canvas, Line } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { KnitCompanion } from './KnitCompanion';
import { ui } from '@/theme/styles';
import { MATTE_BLUE, stockSurface } from '@/theme/materials';
import { fonts, INK } from '@/theme/tokens';
import { PaperTexture } from './PaperTexture';

export function BriefBlock({ brief, failed = false, showBaku = true, motionStyle }: {
  brief: BriefJob; failed?: boolean; showBaku?: boolean; motionStyle?: AnimatedProps<ViewProps>['style'];
}) {
  const [ruling, setRuling] = useState({ width: 0, height: 0 });
  const { fontScale } = useWindowDimensions();
  const lineStep = 24 * fontScale;
  const unavailable = failed || brief.status === 'failed' || (brief.status === 'ready' && !brief.text);
  const pending = !unavailable && brief.status === 'pending';
  return <Animated.View testID="photo-notes" style={[stockSurface, styles.brief, motionStyle]}>
    <PaperTexture />
    <Text allowFontScaling style={[ui.briefLabel, styles.title]}>Photo notes</Text>
    {unavailable || pending ? <View style={styles.status} accessibilityLiveRegion="polite">
      {showBaku && <KnitCompanion width={96} />}
      <Text allowFontScaling style={styles.copy}>{unavailable
        ? 'Baku couldn’t find the words. Your colors are here.'
        : 'Your colors are ready. Baku is finding the words…'}</Text>
    </View> : <View onLayout={(event) => setRuling({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      <Canvas accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: Math.floor(ruling.height / lineStep) }, (_, index) => <Line key={index}
          p1={{ x: 0, y: lineStep * (index + 1) - 1 }} p2={{ x: ruling.width, y: lineStep * (index + 1) - 1 }}
          color="#7FA1C44D" strokeWidth={1} />)}
      </Canvas>
      <Text allowFontScaling style={styles.copy}>{brief.text}</Text>
    </View>}
  </Animated.View>;
}
const styles = StyleSheet.create({
  status: { gap: 12, minHeight: 72 },
  brief: { padding: 18, borderRadius: 3 },
  title: { borderTopWidth: 1, borderTopColor: MATTE_BLUE, paddingTop: 8, marginBottom: 10 },
  copy: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: INK },
});
