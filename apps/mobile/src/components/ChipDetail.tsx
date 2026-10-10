import type { ColorRole, MobileKit } from '@inzpo/shared';
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import * as Clipboard from 'expo-clipboard';
import { haptics } from '@/lib/haptics';
import { ActionButton } from './ActionButton';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { CHIP_FLIP, chipFlipTiming, chipReadability } from '@/lib/chip-flip';
import type { ChipSlot } from '@/lib/result-layout';
import { roleSample } from '@/lib/result-pins';
import { FADE_TIMING } from '@/theme/motion';
import { liftedStockShadow, LABEL_STOCK, stockSurface } from '@/theme/materials';
import { CANVAS, fonts, INK } from '@/theme/tokens';
import { pinRing } from './FilmPrint';
import { InkIcon } from './InkIcon';
import { PaintChip } from './PaintChip';
import { PaperTexture } from './PaperTexture';

export function ChipDetail({ kit, role, slot, origin, onClose, onEdit }: {
  kit: MobileKit; role: ColorRole; slot: ChipSlot; origin: { x: number; y: number }; onClose: () => void; onEdit: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { width, height, fontScale } = useWindowDimensions();
  const timing = chipFlipTiming(reducedMotion);
  const [phase, setPhase] = useState<'opening' | 'back' | 'closing'>('opening');
  const [copyState, setCopyState] = useState<'ready' | 'busy' | 'copied' | 'failed'>('ready');
  const copying = useRef(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const angle = useSharedValue(0);
  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const fade = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const closing = useRef(false);
  const centerX = origin.x + slot.width / 2;
  const centerY = origin.y + slot.height / 2;
  const color = kit.roles[role]!;
  const sample = roleSample(kit, role);
  const { copy } = chipReadability(kit, role);
  const sourceCopy = photoFailed ? 'Couldn’t load the photo.' : !kit.photo ? 'No photo in this kit.' : sample ? 'From this spot.' : 'Chosen by you. No photo sample attached.';
  const backLabel = `${role}: ${color.toLowerCase()}. ${copy} ${sourceCopy}`;
  const photoScale = 96 / 320;
  useEffect(() => {
    if (closing.current) return;
    // Fade is the only reduced-motion animation. The table stays completely still.
    fade.set(withTiming(1, FADE_TIMING));
    if (!reducedMotion) {
      lift.set(withTiming(-6, { duration: CHIP_FLIP.liftMs }));
      scale.set(withTiming(1.04, { duration: CHIP_FLIP.liftMs }));
      dx.set(withTiming(width / 2 - centerX, { duration: CHIP_FLIP.liftMs }));
      dy.set(withTiming(height / 2 - centerY, { duration: CHIP_FLIP.liftMs }));
      angle.set(withDelay(CHIP_FLIP.liftMs, withTiming(180, { duration: CHIP_FLIP.rotationMs })));
    }
    const openingTimer = setTimeout(() => setPhase('back'), timing.openMs);
    openingTimerRef.current = openingTimer;
    return () => {
      [fade, lift, scale, dx, dy, angle].forEach(cancelAnimation);
      clearTimeout(openingTimer);
    };
  }, [reducedMotion, fade, lift, scale, dx, dy, angle, width, height, centerX, centerY, timing.openMs]);
  useEffect(() => {
    if (phase === 'back') AccessibilityInfo.announceForAccessibility(backLabel);
  }, [phase, backLabel]);
  const travel = useAnimatedStyle(() => ({
    transform: [{ translateX: reducedMotion ? width / 2 - centerX : dx.value },
      { translateY: reducedMotion ? height / 2 - centerY : dy.value + lift.value }, { scale: reducedMotion ? 1 : scale.value }],
  }));
  const front = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 - fade.value : 1,
    transform: reducedMotion ? [] : [{ perspective: CHIP_FLIP.perspective }, { rotateY: `${angle.value}deg` }, { rotateZ: `${slot.rotation}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: reducedMotion ? fade.value : 1,
    transform: reducedMotion ? [] : [{ perspective: CHIP_FLIP.perspective }, { rotateY: `${angle.value - 180}deg` }],
  }));
  const scrim = useAnimatedStyle(() => ({ opacity: fade.value * 0.45 }));
  const edge = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0 : Math.abs(Math.sin(angle.value * Math.PI / 180)),
    width: reducedMotion ? 0 : 1.5 * Math.abs(Math.sin(angle.value * Math.PI / 180)),
    left: -slot.width / 2 * Math.cos(angle.value * Math.PI / 180),
  }));
  function close() {
    if (closing.current) return;
    closing.current = true;
    setPhase('closing');
    if (openingTimerRef.current) clearTimeout(openingTimerRef.current);
    if (timer.current) clearTimeout(timer.current);
    fade.set(withTiming(0, FADE_TIMING));
    if (!reducedMotion) {
      angle.set(withTiming(0, { duration: CHIP_FLIP.rotationMs }));
      dx.set(withDelay(CHIP_FLIP.rotationMs, withTiming(0, { duration: CHIP_FLIP.liftMs })));
      dy.set(withDelay(CHIP_FLIP.rotationMs, withTiming(0, { duration: CHIP_FLIP.liftMs })));
      scale.set(withDelay(CHIP_FLIP.rotationMs, withTiming(1, { duration: CHIP_FLIP.liftMs })));
      lift.set(withDelay(CHIP_FLIP.rotationMs, withTiming(0, { duration: CHIP_FLIP.liftMs })));
    }
    timer.current = setTimeout(() => onCloseRef.current(), timing.closeMs);
  }
  const touchY = useRef(0);
  const scrolling = useRef(false);
  const backWidth = Math.min(width - 48, 290 * Math.min(fontScale, 1.3));
  const backHeight = Math.min(height - 100, Math.max(500, 480 * fontScale));
  const flipped = phase === 'back';
  async function copyHex() {
    if (copying.current) return;
    copying.current = true; setCopyState('busy');
    try { await Clipboard.setStringAsync(color.toLowerCase()); setCopyState('copied'); void haptics.success(); }
    catch { setCopyState('failed'); }
    finally { copying.current = false; }
  }
  return <Modal transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
    <View testID="chip-detail-layer" style={styles.overlay} accessibilityViewIsModal
      onTouchStart={(event) => { touchY.current = event.nativeEvent.pageY; scrolling.current = false; }}
      onTouchEnd={(event) => { if (!scrolling.current && event.nativeEvent.pageY - touchY.current > 35) close(); }}>
      <Animated.View pointerEvents="none" style={[styles.scrim, scrim]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Return to your colors" onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View style={[{ position: 'absolute', left: centerX, top: centerY }, travel]}>
        <Animated.View testID="chip-detail-front" pointerEvents={flipped ? 'none' : 'auto'}
          accessibilityElementsHidden={flipped} importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
          style={[styles.face, { left: -slot.width / 2, top: -slot.height / 2 }, front]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${role}: ${color}. Return this chip to your colors.`}
            accessibilityState={{ expanded: false }} onPress={close}>
            <PaintChip role={role} color={color} width={slot.width} height={slot.height} lifted />
          </Pressable>
        </Animated.View>
        <Animated.View testID="chip-detail-back" pointerEvents={flipped ? 'auto' : 'none'}
          accessibilityElementsHidden={!flipped} importantForAccessibility={!flipped ? 'no-hide-descendants' : 'auto'}
          style={[stockSurface, styles.face, { boxShadow: liftedStockShadow, left: -backWidth / 2, top: -backHeight / 2,
            width: backWidth, height: backHeight }, back]}>
          <PaperTexture />
          <View style={{ height: 16, backgroundColor: color }}><PaperTexture kind="color" tileSize={128} /></View>
          <ScrollView testID="chip-detail-scroll" contentContainerStyle={styles.detailContent} onScrollBeginDrag={() => { scrolling.current = true; }}>
            <Pressable testID="chip-detail-toggle" accessibilityRole="button" accessibilityLabel={backLabel}
              accessibilityHint="Tap to return. Touch and hold to edit this color."
              accessibilityState={{ expanded: flipped }} accessibilityActions={[{ name: 'edit', label: 'Edit color' }]}
              onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'edit') onEdit(); }}
              onPress={close} onLongPress={onEdit} style={{ gap: 20 }}>
              <Text allowFontScaling style={styles.copy}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
              <Text allowFontScaling style={styles.hex}>{color.toLowerCase()}</Text>
              <Text allowFontScaling style={styles.copy}>{copy}</Text>
              {kit.photo && sample && !photoFailed && <View style={styles.crop}>
                <Image testID="chip-photo-crop" source={{ uri: kit.photo.url }} contentFit="fill" accessible={false}
                  onError={() => setPhotoFailed(true)}
                  style={{ position: 'absolute', width: kit.photo.width * photoScale, height: kit.photo.height * photoScale,
                    left: 48 - sample.x * kit.photo.width * photoScale, top: 48 - sample.y * kit.photo.height * photoScale }} />
                <Canvas pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
                  <Group transform={[{ translateX: 48 }, { translateY: 48 }, { scale: 0.8 }]}>
                    <Path path={pinRing} style="stroke" color={LABEL_STOCK} strokeWidth={5} />
                    <Path path={pinRing} style="stroke" color={INK} strokeWidth={2.5} />
                  </Group>
                  <Circle cx={48} cy={48} r={3.7} color={LABEL_STOCK} />
                  <Circle cx={48} cy={48} r={3} color={color} />
                </Canvas>
              </View>}
              <Text allowFontScaling style={styles.copy}>{sourceCopy}</Text>
            </Pressable>
            <View style={{ gap: 10, marginTop: 18 }}>
              <ActionButton label="Edit color" primary onPress={onEdit} />
              <ActionButton label={copyState === 'copied' ? 'Hex copied' : copyState === 'busy' ? 'Copying…' : 'Copy hex'} disabled={copyState === 'busy'} onPress={() => void copyHex()} />
              {copyState === 'failed' && <Text accessibilityRole="alert" style={styles.copy}>Couldn’t copy this color. Please try again.</Text>}
            </View>
          </ScrollView>
        </Animated.View>
        <Animated.View pointerEvents="none" accessible={false} style={[styles.edge, { top: -slot.height / 2, height: slot.height }, edge]}>
          <PaperTexture tileSize={80} />
        </Animated.View>
      </Animated.View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close color detail" onPress={close}
        style={[styles.close, { top: Math.max(24, height * 0.06) }]}><InkIcon name="close" /></Pressable>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: CANVAS },
  face: { position: 'absolute', backfaceVisibility: 'hidden', borderRadius: 2 },
  detailContent: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 18 },
  hex: { fontFamily: fonts.mono, fontSize: 19, color: INK },
  copy: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: INK },
  crop: { width: 96, height: 96, alignSelf: 'center', overflow: 'hidden', backgroundColor: LABEL_STOCK },
  close: { position: 'absolute', right: 24, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  edge: { position: 'absolute', backgroundColor: LABEL_STOCK, borderLeftWidth: 0.5, borderLeftColor: '#FFFDF8', borderRightWidth: 0.5, borderRightColor: '#B8AD9B' },
});
