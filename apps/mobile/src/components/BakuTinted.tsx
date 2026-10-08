import type { RoleColors } from '@inzpo/shared';
import type { SkRuntimeEffect } from '@shopify/react-native-skia';
import { Component, type ReactNode } from 'react';
import { bakuTintAssets } from '@/lib/baku-assets';
import { stripeColors } from '@/lib/baku-tint';
import type { BakuPose } from './Baku';

export const BAKU_TINT_SKSL = `
uniform shader base;
uniform shader shade;
uniform shader band1;
uniform shader band2;
uniform shader band3;
uniform shader band4;
uniform shader band5;
uniform shader band6;
uniform float3 color1;
uniform float3 color2;
uniform float3 color3;
uniform float3 color4;
uniform float3 color5;
uniform float3 color6;
uniform float revealed[6];

half4 main(float2 p) {
  half4 sprite = base.eval(p);
  if (sprite.a <= 0) return half4(0);
  float light = shade.eval(p).r * (255.0 / 128.0);
  // Image shaders are premultiplied. Blend straight RGB, then restore alpha.
  float3 rgb = sprite.rgb / sprite.a;
  rgb = mix(rgb, clamp(color1 * light, 0.0, 1.0), band1.eval(p).r * revealed[0]);
  rgb = mix(rgb, clamp(color2 * light, 0.0, 1.0), band2.eval(p).r * revealed[1]);
  rgb = mix(rgb, clamp(color3 * light, 0.0, 1.0), band3.eval(p).r * revealed[2]);
  rgb = mix(rgb, clamp(color4 * light, 0.0, 1.0), band4.eval(p).r * revealed[3]);
  rgb = mix(rgb, clamp(color5 * light, 0.0, 1.0), band5.eval(p).r * revealed[4]);
  rgb = mix(rgb, clamp(color6 * light, 0.0, 1.0), band6.eval(p).r * revealed[5]);
  return half4(rgb * sprite.a, sprite.a);
}`;

type SkiaModule = typeof import('@shopify/react-native-skia');
let skia: SkiaModule | null = null;
let effect: SkRuntimeEffect | null = null;
try {
  // A missing native runtime must still leave the full-color sprite visible.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- import failures need the sprite fallback
  skia = require('@shopify/react-native-skia') as SkiaModule;
  effect = skia.Skia.RuntimeEffect.Make(BAKU_TINT_SKSL);
} catch {
  skia = null;
}

type Props = {
  pose: BakuPose; size: number; roles: RoleColors; revealedBands: number;
  fallback: ReactNode; testID?: string;
};

class TintFallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function TintedSprite({ pose, size, roles, revealedBands, fallback, testID }: Props) {
  const { Canvas, Fill, Shader, ImageShader, useImage } = skia!;
  // Native useImage resolves these grouped assets at PixelRatio.get().
  const assets = bakuTintAssets[pose];
  // Fixed hook order: base, shade, then masks in COLOR_ROLES order.
  const base = useImage(assets[0]);
  const shade = useImage(assets[1]);
  const band1 = useImage(assets[2]);
  const band2 = useImage(assets[3]);
  const band3 = useImage(assets[4]);
  const band4 = useImage(assets[5]);
  const band5 = useImage(assets[6]);
  const band6 = useImage(assets[7]);
  const images = [base, shade, band1, band2, band3, band4, band5, band6];
  if (images.some((image) => !image)) return fallback;
  const stripes = stripeColors(roles, revealedBands);
  const uniforms = {
    ...Object.fromEntries(stripes.map((stripe, index) => [`color${index + 1}`, stripe.color])),
    revealed: stripes.map((stripe) => stripe.revealed),
  };
  // TODO(motion): 180ms top-to-bottom stripe wipe
  return (
    <Canvas style={{ width: size, height: size }} accessible={false} testID={testID} colorSpace="srgb">
      <Fill>
        <Shader source={effect!} uniforms={uniforms}>
          {images.map((image, index) => (
            <ImageShader key={index} image={image} fit="fill" rect={{ x: 0, y: 0, width: size, height: size }} tx="clamp" ty="clamp" />
          ))}
        </Shader>
      </Fill>
    </Canvas>
  );
}

export function BakuTinted(props: Props) {
  if (!skia || !effect) return props.fallback;
  return <TintFallback fallback={props.fallback}><TintedSprite {...props} /></TintFallback>;
}
