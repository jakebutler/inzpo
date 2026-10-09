import { Image } from 'expo-image';
import { BlurMask, Canvas, Oval } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, type ViewProps } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming, type AnimatedProps } from 'react-native-reanimated';
import { BLINK, scheduleBlinks } from '@/lib/blink';
import { FADE_TIMING } from '@/theme/motion';
import { Baku, type BakuPose } from './Baku';

const assets = { idle: require('../../assets/baku-v7/idle.png'), success: require('../../assets/baku-v7/success.png') };

export function CornerBaku({ pose = 'idle', focused, motionStyle, shadowStyle, testID = 'result-baku', shadowTestID = 'baku-contact-shadow', size = 62 }: {
  pose?: BakuPose; focused: boolean; motionStyle?: AnimatedProps<ViewProps>['style']; shadowStyle?: AnimatedProps<ViewProps>['style'];
  testID?: string; shadowTestID?: string; size?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [previousPose, setPreviousPose] = useState(pose);
  const lastPose = useRef(pose);
  const breath = useSharedValue(1);
  const lid = useSharedValue(0);
  const fade = useSharedValue(1);
  const active = focused && foreground && (pose === 'idle' || pose === 'success');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (lastPose.current !== pose) {
      setPreviousPose(lastPose.current);
      lastPose.current = pose;
      fade.set(0);
      fade.set(withTiming(1, FADE_TIMING));
      timer = setTimeout(() => setPreviousPose(pose), FADE_TIMING.duration);
    }
    return () => { clearTimeout(timer); cancelAnimation(fade); };
  }, [pose, fade]);
  useEffect(() => {
    breath.set(1);
    lid.set(0);
    if (active && !reducedMotion) {
      breath.set(withRepeat(withTiming(1.015, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true));
    }
    const stop = scheduleBlinks(() => {
      // Cover just the eye discs with felt-colored lids. A whole-pose swap
      // would shift this cutout's silhouette and feet on every blink.
      lid.set(withSequence(withTiming(1, { duration: BLINK.closeMs }),
        withDelay(BLINK.holdMs, withTiming(0, { duration: BLINK.openMs }))));
    }, { reducedMotion, active: active && pose === 'idle' });
    return () => { stop(); cancelAnimation(breath); cancelAnimation(lid); };
  }, [active, pose, reducedMotion, breath, lid]);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: reducedMotion ? 1 : breath.value }] }));
  const lidStyle = useAnimatedStyle(() => ({ opacity: reducedMotion ? 0 : lid.value }));
  const currentStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const previousStyle = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
  function sprite(state: BakuPose, testID?: string) {
    if (state !== 'idle' && state !== 'success') return <Baku pose={state} size={62} mirrored skipTransition />;
    return <Image testID={testID} accessible={false} source={assets[state]} contentFit="contain"
      style={StyleSheet.flatten([styles.sprite, { height: state === 'idle' ? 52 : 50 }])} />;
  }
  return (
    <Animated.View testID={testID} pointerEvents="none" accessible={false} style={[styles.stage,
      { transformOrigin: 'bottom left', transform: [{ scale: size / 62 }] }]}>
      <Animated.View testID={shadowTestID} style={[styles.shadow, shadowStyle]}>
        <Canvas style={styles.shadowCanvas} pointerEvents="none" accessible={false}>
          <Oval x={10} y={8} width={63} height={13} color="#1C1B1914"><BlurMask blur={4} style="normal" /></Oval>
          <Oval x={18} y={11} width={47} height={7} color="#1C1B1933"><BlurMask blur={1.5} style="normal" /></Oval>
        </Canvas>
      </Animated.View>
      <Animated.View style={[styles.figure, motionStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.breath, breathStyle]}>
          {previousPose !== pose && <Animated.View testID={`${testID}-previous-pose`} style={[StyleSheet.absoluteFill, previousStyle]}>{sprite(previousPose)}</Animated.View>}
          <Animated.View style={[StyleSheet.absoluteFill, currentStyle]}>
            {sprite(pose, `baku-${pose}`)}
            {pose === 'idle' && <Animated.View style={[styles.eyes, lidStyle]}>
              {/* Source eye centers relative to the tight 679x570 alpha crop. */}
              <Animated.View style={[styles.lid, styles.nearEye]} />
              <Animated.View style={[styles.lid, styles.farEye]} />
            </Animated.View>}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 62, height: 62 },
  figure: { position: 'absolute', bottom: 0, width: 62, height: 52 },
  breath: { transformOrigin: 'bottom center' },
  sprite: { position: 'absolute', bottom: 0, width: 62, transform: [{ scaleX: -1 }] },
  eyes: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, transform: [{ scaleX: -1 }] },
  lid: { position: 'absolute', backgroundColor: '#D2C1AA', borderRadius: 8, borderBottomWidth: 0.7, borderBottomColor: '#493E33' },
  nearEye: { left: 16.9, top: 16.8, width: 8.2, height: 8.8 },
  farEye: { left: 4.1, top: 17.1, width: 2.8, height: 5.5 },
  shadow: { position: 'absolute', bottom: 2, left: 9, width: 47, height: 7 },
  shadowCanvas: { position: 'absolute', left: -18, top: -11, width: 83, height: 29 },
});
