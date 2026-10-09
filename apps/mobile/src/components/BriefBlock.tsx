import { type BriefJob } from '@inzpo/shared';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { Baku } from './Baku';
import { ui } from '@/theme/styles';

export function BriefBlock({ brief, failed = false, showBaku = true, motionStyle }: {
  brief: BriefJob; failed?: boolean; showBaku?: boolean; motionStyle?: AnimatedProps<ViewProps>['style'];
}) {
  if (failed || brief.status === 'failed' || (brief.status === 'ready' && !brief.text)) {
    return (
      <Animated.View style={[styles.status, motionStyle]} accessibilityLiveRegion="polite">
        {showBaku && <Baku pose="errorBrief" />}
        <Text allowFontScaling style={ui.message}>Baku couldn’t finish the brief. Your colors are here.</Text>
      </Animated.View>
    );
  }
  if (brief.status === 'pending') {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        {showBaku && <Baku pose="chewing" />}
        <Text allowFontScaling style={ui.message}>Baku is chewing on it…</Text>
      </View>
    );
  }
  return (
    <Animated.View style={motionStyle}>
      <Text allowFontScaling style={ui.briefLabel}>Description</Text>
      <Text allowFontScaling style={ui.body}>{brief.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ status: { alignItems: 'center', gap: 12, paddingVertical: 12 } });
