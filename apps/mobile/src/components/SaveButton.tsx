import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { FADE_TIMING } from '@/theme/motion';
import { fonts, PAPER } from '@/theme/tokens';
import { ActionButton } from './ActionButton';

export function SaveButton({ saved, saving, disabled, onPress }: { saved: boolean; saving: boolean; disabled: boolean; onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const labelProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);
  useEffect(() => {
    labelProgress.set(withTiming(saved ? 1 : 0, FADE_TIMING));
    checkProgress.set(withTiming(saved ? 1 : 0, { ...FADE_TIMING, duration: reducedMotion ? 150 : 240 }));
    return () => { cancelAnimation(labelProgress); cancelAnimation(checkProgress); };
  }, [saved, reducedMotion, labelProgress, checkProgress]);
  const saveStyle = useAnimatedStyle(() => ({ opacity: 1 - labelProgress.value }));
  const savedStyle = useAnimatedStyle(() => ({ opacity: labelProgress.value }));
  // react-native-svg is not installed. Reveal the two check strokes through
  // a clip; reduced motion uses opacity only and never changes the clip width.
  const checkStyle = useAnimatedStyle(() => reducedMotion
    ? { width: 24, opacity: checkProgress.value }
    : { width: 24 * checkProgress.value, opacity: 1 });

  return (
    <ActionButton label={saved ? 'Saved' : saving ? 'Saving…' : 'Save'} primary disabled={disabled || saved} disabledOpacity={saved ? 1 : 0.4} onPress={onPress}>
      <View style={styles.row}>
        {saved && (
          <View style={styles.checkSlot} accessible={false}>
            <Animated.View testID="save-check" style={[styles.clip, checkStyle]}>
              <View style={styles.check} />
            </Animated.View>
          </View>
        )}
        <View>
          {saved ? (
            <>
              <Animated.Text allowFontScaling style={[styles.label, savedStyle]}>Saved</Animated.Text>
              <Animated.Text allowFontScaling accessible={false} style={[styles.label, styles.oldLabel, saveStyle]}>Save</Animated.Text>
            </>
          ) : <Text allowFontScaling style={styles.label}>{saving ? 'Saving…' : 'Save'}</Text>}
        </View>
      </View>
    </ActionButton>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 16, color: PAPER, textAlign: 'center' },
  oldLabel: { position: 'absolute', left: 0, right: 0, top: 0 },
  checkSlot: { width: 24, height: 24 },
  clip: { overflow: 'hidden', height: 24 },
  check: { width: 9, height: 16, borderRightWidth: 2, borderBottomWidth: 2, borderColor: PAPER, transform: [{ rotate: '45deg' }], marginLeft: 7, marginTop: 1 },
});
