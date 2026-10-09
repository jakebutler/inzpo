import { Atlas, Canvas, Skia, useImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState, PixelRatio, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { chewFrame, COLUMNS, FRAME_HEIGHT, FRAME_WIDTH } from './sequence';

const atlas = require('../../assets/munch/chew.webp');
const still = require('../../assets/munch/still.png');

/** The spike's Skia atlas player, scoped to waiting: no lab UI or artificial deadline. */
export function MunchPlayer({ width, active = true }: { width: number; active?: boolean }) {
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);
  return <View testID="munch-player" pointerEvents="none" style={{ width, height: width * FRAME_HEIGHT / FRAME_WIDTH, alignSelf: 'center' }}>
    {/* Avoid decoding the atlas at all for reduced motion. */}
    {reducedMotion ? <Still width={width} /> : <MovingMunch width={width} active={active} />}
  </View>;
}

function Still({ width }: { width: number }) {
  return <Image testID="baku-chewing" source={still} contentFit="contain" accessible={false}
    style={{ width, height: width * FRAME_HEIGHT / FRAME_WIDTH }} />;
}

function MovingMunch({ width, active }: { width: number; active: boolean }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const image = useImage(atlas, onError);
  // Derive density from the decoded texture, including Metro's web asset choice.
  const density = image ? image.width() / (COLUMNS * FRAME_WIDTH) : PixelRatio.get() > 2 ? 3 : 2;
  const elapsed = useSharedValue(0);
  const resume = useSharedValue(true);
  const clock = useFrameCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (resume.get()) { resume.set(false); return; }
    elapsed.set(elapsed.get() + (timeSincePreviousFrame ?? 0));
  }, false);
  useEffect(() => {
    const update = (state: string | null) => {
      resume.set(true);
      clock.setActive(active && !!image && !failed && state === 'active');
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); clock.setActive(false); };
  }, [active, image, failed, clock, resume]);
  const sprites = useDerivedValue(() => {
    const index = chewFrame(elapsed.get());
    return [{ x: index % COLUMNS * FRAME_WIDTH * density, y: Math.floor(index / COLUMNS) * FRAME_HEIGHT * density,
      width: FRAME_WIDTH * density, height: FRAME_HEIGHT * density }];
  });
  const transforms = useMemo(() => [Skia.RSXform(width / (FRAME_WIDTH * density), 0, 0, 0)], [width, density]);
  // A full-size still is visible during decode or if decode fails.
  return image && !failed ? <Canvas testID="munch-atlas" accessible={false} style={{ width, height: width * FRAME_HEIGHT / FRAME_WIDTH }}>
    <Atlas image={image} sprites={sprites} transforms={transforms} />
  </Canvas> : <Still width={width} />;
}
