import { type BriefJob } from '@inzpo/shared';
import { Canvas, Line } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { Baku } from './Baku';
import { ui } from '@/theme/styles';
import { stockSurface } from '@/theme/materials';
import { fonts, INK, VERMILION } from '@/theme/tokens';
import { PaperTexture } from './PaperTexture';
import { ChewingCaption } from './ChewingCaption';

export function BriefBlock({ brief, failed = false, showBaku = true, motionStyle }: {
  brief: BriefJob; failed?: boolean; showBaku?: boolean; motionStyle?: AnimatedProps<ViewProps>['style'];
}) {
  const [ruling, setRuling] = useState({ width: 0, height: 0 });
  const { fontScale } = useWindowDimensions();
  const lineStep = 24 * fontScale;
  if (failed || brief.status === 'failed' || (brief.status === 'ready' && !brief.text)) {
    return (
      <Animated.View style={[styles.status, motionStyle]} accessibilityLiveRegion="polite">
        {showBaku && <Baku pose="errorBrief" />}
        <Text allowFontScaling style={ui.message}>Baku couldn’t finish the brief. Your colors are here.</Text>
      </Animated.View>
    );
  }
  if (brief.status === 'pending') {
    if (!showBaku) return null;
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        {showBaku && <Baku pose="chewing" />}
        <ChewingCaption />
      </View>
    );
  }
  return (
    <Animated.View style={[stockSurface, styles.brief, motionStyle]}>
      <PaperTexture />
      <Text allowFontScaling style={[ui.briefLabel, styles.title]}>The brief</Text>
      <View onLayout={(event) => setRuling({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
        <Canvas accessible={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
          {Array.from({ length: Math.floor(ruling.height / lineStep) }, (_, index) => <Line key={index}
            p1={{ x: 0, y: lineStep * (index + 1) - 1 }} p2={{ x: ruling.width, y: lineStep * (index + 1) - 1 }}
            color="#7FA1C44D" strokeWidth={1} />)}
        </Canvas>
        <Text allowFontScaling style={styles.copy}>{brief.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  brief: { padding: 16, borderRadius: 2 },
  title: { borderTopWidth: 1, borderTopColor: VERMILION, paddingTop: 6, marginBottom: 8 },
  copy: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: INK },
});
