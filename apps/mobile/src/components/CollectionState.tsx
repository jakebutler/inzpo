import { ActivityIndicator, Text, View } from 'react-native';
import { KnitCompanion } from './KnitCompanion';
import { ActionButton } from './ActionButton';
import { ui } from '@/theme/styles';
import { INK } from '@/theme/tokens';

export function CollectionState({ title, message, busy = false, action, onAction }: {
  title: string; message: string; busy?: boolean; action?: string; onAction?: () => void;
}) {
  return <View style={{ alignItems: 'center', gap: 14, paddingVertical: 28 }} accessibilityLiveRegion="polite">
    <KnitCompanion width={174} />
    <Text accessibilityRole="header" style={[ui.heading, { fontSize: 27, lineHeight: 32, textAlign: 'center' }]}>{title}</Text>
    <Text style={[ui.body, { textAlign: 'center', maxWidth: 320 }]}>{message}</Text>
    {busy && <ActivityIndicator color={INK} accessibilityLabel="Loading inspiration" />}
    {action && onAction && <View style={{ alignSelf: 'stretch', marginTop: 8 }}><ActionButton label={action} primary onPress={onAction} /></View>}
  </View>;
}
