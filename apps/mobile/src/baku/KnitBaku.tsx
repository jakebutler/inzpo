import { KNIT_SHADER } from './shader';
import { COLOR_ROLES, type RoleColors } from '@inzpo/shared';
import { Canvas, ImageShader, Shader, Skia, useImage, Vertices, type Uniforms } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { coatFillAt, deform, poseAt } from './motion';

const sources = [require('../../assets/baku-performance/neutral.webp'), require('../../assets/baku-performance/cheeks.webp'),
  require('../../assets/baku-performance/squeeze.webp'), require('../../assets/baku-performance/pleased.webp'),
  require('../../assets/baku-performance/coat-material.webp')];
const effect = Skia.RuntimeEffect.Make(KNIT_SHADER);

const columns = 48, rows = 32;
const uv = Array.from({ length: (columns + 1) * (rows + 1) }, (_, i) => ({ x: (i % (columns + 1)) / columns, y: Math.floor(i / (columns + 1)) / rows }));
const indices: number[] = [];
for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
  const i = y * (columns + 1) + x;
  indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
}

/** The approved continuous felt mesh, rendered natively. Empty roles keep undyed panels. */
export function KnitBaku({ width, elapsed, readyAt, roles, onLoaded }: {
  width: number; elapsed: SharedValue<number>; readyAt: SharedValue<number>; roles?: RoleColors | null; onLoaded?: () => void;
}) {
  const neutral = useImage(sources[0]), cheeks = useImage(sources[1]), squeeze = useImage(sources[2]);
  const pleased = useImage(sources[3]), material = useImage(sources[4]);
  const height = width * 2 / 3;
  const loaded = !!(neutral && cheeks && squeeze && pleased && material && effect);
  useEffect(() => { if (loaded) onLoaded?.(); }, [loaded, onLoaded]);
  const palette = useMemo(() => COLOR_ROLES.flatMap(role => {
    const hex = roles?.[role];
    return hex ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1) : [.61, .61, .61, 0];
  }), [roles]);
  const pose = useDerivedValue(() => poseAt(elapsed.value, readyAt.value < 0 ? null : readyAt.value));
  const vertices = useDerivedValue(() => uv.map(point => {
    const next = deform(point.x, point.y, pose.value);
    return { x: next.x * width, y: next.y * height };
  }));
  const uniforms = useDerivedValue<Uniforms>(() => ({ fullness: pose.value.fullness, closed: pose.value.closed,
    happy: pose.value.happy, coatFill: coatFillAt(elapsed.value, readyAt.value < 0 ? null : readyAt.value), palette }));
  if (!loaded) return <Image accessible={false} source={require('../../assets/baku-performance/neutral-monotone.webp')}
    contentFit="contain" style={{ width, height }} />;
  return <Canvas testID="knit-baku" accessible={false} pointerEvents="none" style={{ width, height }}>
    <Vertices vertices={vertices} textures={uv} indices={indices} mode="triangles" blendMode="dst">
      <Shader source={effect!} uniforms={uniforms}>
        {[neutral, cheeks, squeeze, pleased, material].map((image, i) => <ImageShader key={i} image={image!}
          fit="fill" rect={{ x: 0, y: 0, width: 1, height: 1 }} tx="clamp" ty="clamp" />)}
      </Shader>
    </Vertices>
  </Canvas>;
}
