import { type BriefJob } from '@inzpo/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Baku } from './Baku';
import { ui } from '@/theme/styles';

export function BriefBlock({ brief, failed = false }: { brief: BriefJob; failed?: boolean }) {
  if (failed || brief.status === 'failed' || (brief.status === 'ready' && !brief.text)) {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Baku pose="errorBrief" />
        <Text style={ui.message}>Baku couldn’t finish the brief. Your colors are here.</Text>
      </View>
    );
  }
  if (brief.status === 'pending') {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Baku pose="chewing" />
        <Text style={ui.message}>Baku is chewing on it…</Text>
      </View>
    );
  }
  return <Text style={ui.body}>{brief.text}</Text>;
}

const styles = StyleSheet.create({ status: { alignItems: 'center', gap: 12, paddingVertical: 12 } });
