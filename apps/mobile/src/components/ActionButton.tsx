import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { usePressFeedback } from '@/lib/usePressFeedback';
import { buttonSurface } from '@/theme/buttons';
import { fonts, INK } from '@/theme/tokens';
import { LABEL_STOCK } from '@/theme/materials';
import { PaperTexture } from './PaperTexture';

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
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ActionButton({ label, onPress, disabled = false, primary = false, pressScale, onPressIn, disabledOpacity, children, style, testID }: Props) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotion();
  // A short compression keeps both matte stock variants grounded under the finger.
  const feedback = usePressFeedback({ pressScale: pressScale ?? 1, disabled, disabledOpacity, onPressIn,
    pressOffset: pressed && !disabled ? 2 : 0 });
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { setPressed(true); feedback.onPressIn(); }}
      onPressOut={() => { setPressed(false); feedback.onPressOut(); }}
      style={[styles.button, primary && styles.primary, style,
        buttonSurface(primary, pressed, disabled, reducedMotion), feedback.animatedStyle]}
    >
      <View pointerEvents="none" accessible={false} style={[styles.texture, primary && styles.primary]}>
        <PaperTexture kind={primary ? 'color' : 'paper'} tileSize={240} opacity={primary ? 1 : .75} />
      </View>
      {children ?? <Text allowFontScaling style={[styles.label, primary && styles.primaryLabel]}>{label}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  primary: { borderRadius: 14 },
  texture: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 8, overflow: 'hidden' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 16, color: INK, textAlign: 'center' },
  primaryLabel: { color: LABEL_STOCK },
});
