import { Canvas, Fill, ImageShader, Shader, useImage, type Uniforms } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { chewFrame, COLUMNS, FRAME_COUNT, FRAME_HEIGHT, FRAME_WIDTH } from './sequence';
import { feltTint } from './felt-tint';

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
  const image = useImage(still);
  const height = width * FRAME_HEIGHT / FRAME_WIDTH;
  return image ? <Canvas testID="baku-chewing" accessible={false} style={{ width, height }}>
    <Fill><Shader source={feltTint} uniforms={{ width, frameOffset: [0, 0] }}>
      <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width, height }} tx="clamp" ty="clamp" />
    </Shader></Fill>
  </Canvas> : <Image testID="baku-chewing" source={still} contentFit="contain" accessible={false} style={{ width, height }} />;
}

function MovingMunch({ width, active }: { width: number; active: boolean }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const image = useImage(atlas, onError);
  const height = width * FRAME_HEIGHT / FRAME_WIDTH;
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
  const uniforms = useDerivedValue<Uniforms>(() => {
    const index = chewFrame(elapsed.get());
    return { width, frameOffset: [index % COLUMNS * width, Math.floor(index / COLUMNS) * height] };
  });
  // A full-size still is visible during decode or if decode fails.
  // Work in local display points, so felt geometry is stable at every native
  // pixel density. The child shader scales the decoded atlas automatically.
  return image && !failed ? <Canvas testID="munch-atlas" accessible={false} style={{ width, height }}>
    <Fill><Shader source={feltTint} uniforms={uniforms}>
      <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width: COLUMNS * width, height: FRAME_COUNT / COLUMNS * height }} tx="clamp" ty="clamp" />
    </Shader></Fill>
  </Canvas> : <Still width={width} />;
}
