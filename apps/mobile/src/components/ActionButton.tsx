import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressFeedback } from '@/lib/usePressFeedback';
import { buttonSurface } from '@/theme/buttons';
import { fonts, INK, PAPER } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  pressScale?: number;
  onPressIn?: () => void;
  disabledOpacity?: number;
  children?: ReactNode;
};

export function ActionButton({ label, onPress, disabled = false, primary = false, pressScale, onPressIn, disabledOpacity, children }: Props) {
  const [pressed, setPressed] = useState(false);
  const feedback = usePressFeedback({ pressScale, disabled, disabledOpacity, onPressIn });
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { setPressed(true); feedback.onPressIn(); }}
      onPressOut={() => { setPressed(false); feedback.onPressOut(); }}
      style={[styles.button, buttonSurface(primary, pressed, disabled), feedback.animatedStyle]}
    >
      {children ?? <Text allowFontScaling style={[styles.label, primary && styles.primaryLabel]}>{label}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: 16, color: INK, textAlign: 'center' },
  primaryLabel: { color: PAPER },
});
