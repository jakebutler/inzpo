import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type AnimatedProps } from 'react-native-reanimated';
import { FADE_TIMING } from '@/theme/motion';

const poses = {
  idle: require('../../assets/baku/baku-idle-color.png'),
  chewing: require('../../assets/baku/baku-chewing-color.png'),
  success: require('../../assets/baku/baku-success-color.png'),
  errorBrief: require('../../assets/baku/baku-error-brief-color.png'),
  errorPhoto: require('../../assets/baku/baku-error-photo-color.png'),
  empty: require('../../assets/baku/baku-empty-color.png'),
  notFound: require('../../assets/baku/baku-404-color.png'),
} as const;

export type BakuPose = keyof typeof poses;

export function Baku({ pose = 'idle', size = 96, motionStyle, skipTransition = false }: {
  pose?: BakuPose; size?: number; motionStyle?: AnimatedProps<ViewProps>['style']; skipTransition?: boolean;
}) {
  const lastPose = useRef(pose);
  const [previousPose, setPreviousPose] = useState(pose);
  const progress = useSharedValue(1);
  useEffect(() => {
    if (skipTransition) {
      lastPose.current = pose;
      cancelAnimation(progress);
      progress.set(1);
    } else if (pose !== lastPose.current) {
      setPreviousPose(lastPose.current);
      lastPose.current = pose;
      progress.set(0);
      progress.set(withTiming(1, FADE_TIMING));
    }
    return () => cancelAnimation(progress);
  }, [pose, progress, skipTransition]);
  const currentStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const previousStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  // TODO(motion): Skia stripe wipe/tint: out = roleColor × shade/128;
  // empty stripes stay undyed oatmeal #E4D9C6, never gray or hatched.
  // Keep these color PNGs untinted until Designer's rebuilt masks arrive.
  // TODO(motion): Googly-eye pupil spring and off-screen-aware idle breathing.
  // TODO(motion): Rive state machine `baku`, pose input + hop trigger (dev build).
  return (
    <Animated.View style={[{ width: size, height: size }, motionStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, previousStyle]}>
        <Image source={poses[previousPose]} contentFit="contain" style={{ width: size, height: size }} accessible={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, currentStyle]}>
        <Image source={poses[pose]} contentFit="contain" style={{ width: size, height: size }} accessible={false} testID={`baku-${pose}`} />
      </Animated.View>
    </Animated.View>
  );
}
