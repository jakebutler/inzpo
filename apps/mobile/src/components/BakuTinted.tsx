import type { RoleColors } from '@inzpo/shared';
import type { SamplingOptions, SkRuntimeEffect, Uniforms } from '@shopify/react-native-skia';
import { Component, useMemo, type ReactNode } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import { bakuTintAssets } from '@/lib/baku-assets';
import { OATMEAL_RGB, STRIPE_FEATHER, stripeColors, type StripeProgress, type WipeMode } from '@/lib/baku-tint';
import { bakuStripeBounds } from '@/lib/baku-stripe-bounds';
import { BAKU_SPRITE_PIXELS, bakuEyes } from '@/lib/baku-eyes';
import { PUPIL_FEATHER_PX, type PupilOffset } from '@/lib/baku-pupils';
import type { BakuPose } from './Baku';

// Skia 2.6.2 ImageShader accepts sampling: { B, C }. Mitchell smooths the
// fixed 48/96/144px sprites when displayed at 96–160pt on dense screens.
export const BAKU_IMAGE_SAMPLING: SamplingOptions = { B: 1 / 3, C: 1 / 3 };

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
uniform float progress[6];
uniform float2 bounds[6];
uniform float spriteHeight;
uniform float wipeMode;
uniform float eyeCount;
uniform float4 eyes[2];
uniform float3 whiteColors[2];
uniform float2 pupilOffset;
uniform float spritePixels;

float3 movePupil(float2 p, float3 rgb, float4 eye, float3 whiteColor) {
  if (eye.w <= 0.0) return rgb;
  float2 center = eye.xy * spriteHeight;
  float pupilR = eye.z * spriteHeight;
  float whiteR = eye.w * spriteHeight;
  float feather = ${PUPIL_FEATHER_PX} * spriteHeight / spritePixels;
  float2 offset = pupilOffset * spriteHeight / spritePixels;
  float magnitude = length(offset);
  float maximum = max(0.0, (whiteR - pupilR) * 0.8);
  if (magnitude > maximum) offset *= maximum / magnitude;
  magnitude = length(offset);
  if (magnitude < 0.00001) return rgb;
  float distance = length(p - center);
  // Feather inward so pixels outside the measured white disc never change.
  float whiteMask = 1.0 - smoothstep(whiteR - feather, whiteR, distance);
  if (whiteMask <= 0.0) return rgb;
  float oldPupil = 1.0 - smoothstep(pupilR - feather, pupilR, distance);
  float2 source = p - offset;
  float movedPupil = 1.0 - smoothstep(pupilR - feather, pupilR, length(source - center));
  half4 shifted = base.eval(source);
  float3 clean = mix(rgb, whiteColor, oldPupil);
  float3 moved = mix(clean, shifted.rgb / max(shifted.a, 0.00001), movedPupil);
  // Preserve the photographed white, and approach exact identity at rest.
  return mix(rgb, moved, whiteMask * smoothstep(0.0, feather, magnitude));
}

float dyeCoverage(float y, float2 extent, float progress) {
  if (wipeMode > 0.5) return clamp(progress, 0.0, 1.0);
  if (progress <= 0.0 || extent.y <= extent.x) return 0.0;
  if (progress >= 1.0) return 1.0;
  float front = extent.x + progress * (extent.y - extent.x);
  return 1.0 - smoothstep(front - ${STRIPE_FEATHER}, front + ${STRIPE_FEATHER}, y);
}

float3 dyedColor(float3 color, float coverage) {
  return mix(float3(${OATMEAL_RGB.join(', ')}), color, coverage);
}

half4 main(float2 p) {
  half4 sprite = base.eval(p);
  if (sprite.a <= 0) return half4(0);
  float light = shade.eval(p).r * (255.0 / 128.0);
  // Image shaders are premultiplied. Blend straight RGB, then restore alpha.
  float3 rgb = sprite.rgb / sprite.a;
  float y = p.y / spriteHeight;
  rgb = mix(rgb, clamp(dyedColor(color1, dyeCoverage(y, bounds[0], progress[0])) * light, 0.0, 1.0), band1.eval(p).r);
  rgb = mix(rgb, clamp(dyedColor(color2, dyeCoverage(y, bounds[1], progress[1])) * light, 0.0, 1.0), band2.eval(p).r);
  rgb = mix(rgb, clamp(dyedColor(color3, dyeCoverage(y, bounds[2], progress[2])) * light, 0.0, 1.0), band3.eval(p).r);
  rgb = mix(rgb, clamp(dyedColor(color4, dyeCoverage(y, bounds[3], progress[3])) * light, 0.0, 1.0), band4.eval(p).r);
  rgb = mix(rgb, clamp(dyedColor(color5, dyeCoverage(y, bounds[4], progress[4])) * light, 0.0, 1.0), band5.eval(p).r);
  rgb = mix(rgb, clamp(dyedColor(color6, dyeCoverage(y, bounds[5], progress[5])) * light, 0.0, 1.0), band6.eval(p).r);
  if (eyeCount > 0.5) rgb = movePupil(p, rgb, eyes[0], whiteColors[0]);
  if (eyeCount > 1.5) rgb = movePupil(p, rgb, eyes[1], whiteColors[1]);
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
  pose: BakuPose; size: number; roles: RoleColors; stripeProgress?: StripeProgress; wipeMode?: WipeMode;
  fallback: ReactNode; testID?: string;
  pupilOffset?: PupilOffset;
};

class TintFallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function TintedSprite({ pose, size, roles, stripeProgress, wipeMode = 0, pupilOffset, fallback, testID }: Props) {
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
  const colors = useMemo(() => stripeColors(roles), [roles]);
  const bounds = bakuStripeBounds[pose].map((extent) => extent ?? [0, 0]);
  const eyeTable = bakuEyes[pose];
  const eyes = [0, 1].map((index) => {
    const eye = eyeTable[index];
    return eye ? [eye.cx, eye.cy, eye.pupilR, eye.whiteR] : [0, 0, 0, 0];
  });
  const whiteColors = [0, 1].map((index) => eyeTable[index]?.whiteColor ?? [0, 0, 0]);
  // Skia 2.6's Shader uniforms accept { value: Uniforms }, including a
  // Reanimated DerivedValue. Read progress only inside this UI-thread worklet.
  const uniforms = useDerivedValue<Uniforms>(() => ({
    color1: colors[0], color2: colors[1], color3: colors[2],
    color4: colors[3], color5: colors[4], color6: colors[5],
    progress: stripeProgress ? [
      stripeProgress[0].value, stripeProgress[1].value, stripeProgress[2].value,
      stripeProgress[3].value, stripeProgress[4].value, stripeProgress[5].value,
    ] : [1, 1, 1, 1, 1, 1],
    bounds, spriteHeight: size, wipeMode,
    eyeCount: eyeTable.length, eyes, whiteColors,
    pupilOffset: pupilOffset ? [pupilOffset.value.x, pupilOffset.value.y] : [0, 0],
    spritePixels: BAKU_SPRITE_PIXELS,
  }));
  const images = [base, shade, band1, band2, band3, band4, band5, band6];
  if (images.some((image) => !image)) return fallback;
  return (
    <Canvas style={{ width: size, height: size }} accessible={false} testID={testID} colorSpace="srgb">
      <Fill>
        <Shader source={effect!} uniforms={uniforms}>
          {images.map((image, index) => (
            <ImageShader key={index} image={image} sampling={BAKU_IMAGE_SAMPLING} fit="fill" rect={{ x: 0, y: 0, width: size, height: size }} tx="clamp" ty="clamp" />
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
