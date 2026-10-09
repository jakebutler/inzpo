// Mask roles are stored as straight R=role/6; Skia samples premultiplied RGBA.
export const STRIPE_MASK_SKSL = `
  uniform shader mask;
  uniform float2 offset;
  uniform float band;
  half4 main(float2 p) {
    half4 m = mask.eval(p + offset);
    if (m.a < 0.001) return half4(0);
    float id = floor(m.r / m.a * 6.0 + 0.5);
    if (abs(id - band) > 0.1) return half4(0);
    float light = clamp(m.g / m.a * 2.0, 0.35, 1.0);
    return half4(half3(light * m.a), m.a);
  }
`;
