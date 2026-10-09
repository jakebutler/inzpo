import type { MobileKit } from '@inzpo/shared';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { FilmPrint } from './FilmPrint';
import { KitDeck } from './KitDeck';

export function SavedKit({ kit, failed, onError, placeholder, onEdit, disabled, maxHeight }: {
  kit: MobileKit; failed: boolean; onError: () => void; placeholder: React.ReactNode; onEdit: () => void; disabled: boolean;
  maxHeight: number;
}) {
  const { width } = useWindowDimensions();
  const printWidth = Math.min(350, width - 40);
  const photoHeight = 330 * printWidth / 350;
  const compositionHeight = photoHeight + 50 - 95 + 220;
  // Leave room for the actions on short phones. At accessibility sizes the
  // scrollable page can grow; painted faces compress before readable type.
  const scale = Math.max(0.6, Math.min(1, maxHeight / compositionHeight));
  return <Animated.View testID="saved-composition" entering={FadeIn.duration(150).reduceMotion(ReduceMotion.Never)}
    style={[styles.composition, { width: printWidth * scale, height: compositionHeight * scale }]}>
    <View style={{ width: printWidth, height: compositionHeight, transformOrigin: 'top left', transform: [{ scale }] }}>
      <FilmPrint kit={kit} width={printWidth} height={photoHeight + 50} failed={failed} onError={onError}
        showPins={false} photoPosition={{ left: '50%', top: '34.7%' }} date={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        placeholder={placeholder} onPinPress={() => {}} />
      <Pressable style={styles.deck} accessibilityRole="button" accessibilityLabel="Edit" disabled={disabled}
        accessibilityState={{ disabled }} onPress={onEdit}>
        <KitDeck kit={kit} closed typeSize={11 / scale} />
      </Pressable>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  composition: { alignSelf: 'center', transform: [{ rotate: '-1.75deg' }] },
  deck: { marginTop: -95, marginLeft: 72, height: 220, zIndex: 10 },
});
