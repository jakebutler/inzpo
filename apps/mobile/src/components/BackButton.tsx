import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { usePressFeedback } from '@/lib/usePressFeedback';
import { buttonSurface } from '@/theme/buttons';
import { InkIcon } from './InkIcon';
import { PaperTexture } from './PaperTexture';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** 36pt visible paper face inside a 44pt navigation target. */
export function BackButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const [pressed, setPressed] = useState(false);
  const reducedMotion = useReducedMotion();
  const feedback = usePressFeedback({ pressOffset: pressed ? 2 : 0, disabled });
  const { transform: _, ...surface } = buttonSurface(false, pressed, false, reducedMotion);
  return <AnimatedPressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    onPressIn={() => { setPressed(true); feedback.onPressIn(); }} onPressOut={() => { setPressed(false); feedback.onPressOut(); }}
    style={[styles.target, feedback.animatedStyle]}>
    <View style={[styles.face, surface]}>
      <View pointerEvents="none" style={styles.texture}><PaperTexture tileSize={240} /></View>
      <InkIcon name="back" />
    </View>
  </AnimatedPressable>;
}

const styles = StyleSheet.create({
  target: { width: 44, height: 44, alignSelf: 'flex-start' },
  face: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  texture: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, overflow: 'hidden' },
});
