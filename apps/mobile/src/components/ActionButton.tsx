import { useState, type ReactNode } from 'react';
import { Canvas, LinearGradient, RoundedRect } from '@shopify/react-native-skia';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
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
  const [bounds, setBounds] = useState({ width: 0, height: 48 });
  const reducedMotion = useReducedMotion();
  // Enamel compression overrides the generic scale. Paper retains the existing scale.
  const feedback = usePressFeedback({ pressScale: primary ? pressScale ?? 1 : pressScale, disabled, disabledOpacity, onPressIn,
    pressOffset: pressed && !disabled ? 2 : 0 });
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      onLayout={primary ? (event) => setBounds({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height }) : undefined}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { setPressed(true); feedback.onPressIn(); }}
      onPressOut={() => { setPressed(false); feedback.onPressOut(); }}
      style={[styles.button, primary && styles.enamel, style,
        buttonSurface(primary, pressed, disabled, reducedMotion), feedback.animatedStyle]}
    >
      {!primary && <PaperTexture tileSize={240} />}
      {primary && bounds.width > 0 && <Canvas pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
        <RoundedRect x={0} y={0} width={bounds.width} height={bounds.height} r={24}>
          {/* Fade before readable type to preserve the measured 5.97:1 face. */}
          <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: 12 }} colors={['#FFFFFF18', '#FFFFFF00']} />
        </RoundedRect>
      </Canvas>}
      {children ?? <Text allowFontScaling style={[styles.label, primary && styles.primaryLabel]}>{label}</Text>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  enamel: { borderRadius: 24 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 16, color: INK, textAlign: 'center' },
  primaryLabel: { color: LABEL_STOCK },
});
