import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressFeedback } from '@/lib/usePressFeedback';
import { haptics } from '@/lib/haptics';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Stock lifts back under the finger; cancellation and Reduced Motion share button behavior. */
export function PaperPressable({ children, style, disabled, onPressIn, ...props }: Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const feedback = usePressFeedback({ pressScale: .985, disabled: !!disabled });
  return <AnimatedPressable {...props} disabled={disabled} style={[style, feedback.animatedStyle]}
    onPressIn={event => { feedback.onPressIn(); void haptics.light(); onPressIn?.(event); }} onPressOut={feedback.onPressOut}>
    {children}
  </AnimatedPressable>;
}
