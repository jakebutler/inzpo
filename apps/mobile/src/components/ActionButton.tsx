import { Pressable, StyleSheet, Text } from 'react-native';
import { fonts, INK, PAPER, VERMILION } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
};

export function ActionButton({ label, onPress, disabled = false, primary = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primary, (pressed || disabled) && styles.dimmed]}
    >
      <Text style={[styles.label, primary && styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: INK,
  },
  primary: { backgroundColor: VERMILION, borderColor: VERMILION },
  label: { fontFamily: fonts.bodyMedium, fontSize: 16, color: INK, textAlign: 'center' },
  primaryLabel: { color: PAPER },
  dimmed: { opacity: 0.5 },
});
