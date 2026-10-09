import { Skia } from '@shopify/react-native-skia';

/** Correct the stand-in's tan felt at render time; keep yarn, eyes and blush. */
export const FELT_TINT_SKSL = `
uniform shader image;
uniform float width;
uniform float2 frameOffset;
half4 main(float2 p) {
  half4 pixel = image.eval(p + frameOffset);
  if (pixel.a <= 0.0) return half4(0);
  float2 uv = p / float2(width, width * (144.0 / 176.0));
  float3 rgb = pixel.rgb / pixel.a;
  // The knitted blanket occupies the right upper torso. Feet, the head,
  // lower belly and the far-right tail remain exposed felt.
  float blanket = smoothstep(0.565, 0.60, uv.x) * (1.0 - smoothstep(0.86, 0.89, uv.x)) * (1.0 - smoothstep(0.775, 0.80, uv.y));
  // Pink has more red than yellow; detect the blush by chroma instead of
  // cutting a rectangular hole through the trunk's cream tint.
  float blush = smoothstep(0.02, 0.055, rgb.r + rgb.b - 2.0 * rgb.g);
  float warm = smoothstep(0.025, 0.065, rgb.r - rgb.b)
    * (1.0 - smoothstep(0.14, 0.22, rgb.r - rgb.g));
  // Preserve photographed light and texture while shifting tan toward the
  // cream felt used by the other Baku poses. Alpha never changes.
  float light = dot(rgb, float3(0.2126, 0.7152, 0.0722));
  float coverage = warm * smoothstep(0.3, 0.4, light) * (1.0 - blanket) * (1.0 - blush);
  float3 cream = clamp(float3(1.068, 1.017, 0.928) * (light * 1.04 + 0.025), 0.0, 1.0);
  return half4(mix(rgb, cream, coverage) * pixel.a, pixel.a);
}`;

export const feltTint = Skia.RuntimeEffect.Make(FELT_TINT_SKSL)!;
