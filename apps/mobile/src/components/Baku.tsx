import type { RoleColors } from '@inzpo/shared';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type AnimatedProps } from 'react-native-reanimated';
import { FADE_TIMING } from '@/theme/motion';
import type { StripeProgress, WipeMode } from '@/lib/baku-tint';
import type { PupilOffset } from '@/lib/baku-pupils';
import { BakuTinted } from './BakuTinted';

const poses = {
  idle: require('../../assets/baku-v6/baku-idle-color.png'),
  chewing: require('../../assets/baku-v6/baku-chewing-color.png'),
  success: require('../../assets/baku-v6/baku-success-color.png'),
  errorBrief: require('../../assets/baku-v6/baku-error-brief-color.png'),
  errorPhoto: require('../../assets/baku-v6/baku-error-photo-color.png'),
  empty: require('../../assets/baku-v6/baku-empty-color.png'),
  notFound: require('../../assets/baku-v6/baku-404-color.png'),
} as const;

export type BakuPose = keyof typeof poses;

export function Baku({ pose = 'idle', size = 96, motionStyle, skipTransition = false, roles, stripeProgress, wipeMode, pupilOffset, mirrored = false }: {
  roles?: RoleColors | null; stripeProgress?: StripeProgress; wipeMode?: WipeMode; mirrored?: boolean;
  pose?: BakuPose; size?: number; motionStyle?: AnimatedProps<ViewProps>['style']; skipTransition?: boolean;
  pupilOffset?: PupilOffset;
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
  // TODO(motion): Off-screen-aware idle breathing.
  // TODO(motion): Rive state machine `baku`, pose input + hop trigger (dev build).
  const sprite = (spritePose: BakuPose, testID?: string) => {
    const fallback = <Image source={poses[spritePose]} contentFit="contain" style={{ width: size, height: size }} accessible={false} testID={testID} />;
    return roles ? <BakuTinted key={spritePose} pose={spritePose} size={size} roles={roles} stripeProgress={stripeProgress} wipeMode={wipeMode} pupilOffset={pupilOffset} fallback={fallback} testID={testID} /> : fallback;
  };
  return (
    <Animated.View style={[{ width: size, height: size }, motionStyle]}>
      {previousPose !== pose && !skipTransition && <Animated.View style={[StyleSheet.absoluteFill, previousStyle, mirrored && { transform: [{ scaleX: -1 }] }]}>
        {sprite(previousPose)}
      </Animated.View>}
      <Animated.View style={[StyleSheet.absoluteFill, currentStyle, mirrored && { transform: [{ scaleX: -1 }] }]}>
        {sprite(pose, `baku-${pose}`)}
      </Animated.View>
    </Animated.View>
  );
}
