import { STRIPE_MASK_SKSL } from './stripe';
const { Skia, AlphaType, ColorType, TileMode, FilterMode, MipmapMode, BlendMode } =
  jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

// Real compiled SkSL and Skia color blending: catch role-ID/premultiplication
// bugs that typechecking and frame sequence tests cannot detect.
test.each([1, 2, 3, 4, 5, 6])('mask shader tints only role %i, retaining shade and alpha', (band) => {
  const rgba = { width: 2, height: 1, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const bytes = [Math.round(band * 255 / 6), 96, 255, 128, Math.round((band === 6 ? 1 : band + 1) * 255 / 6), 96, 255, 255];
  const img = Skia.Image.MakeImage(rgba, Skia.Data.fromBytes(Uint8Array.from(bytes)), 8)!;
  const child = img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None);
  const effect = Skia.RuntimeEffect.Make(STRIPE_MASK_SKSL)!;
  expect(effect).toBeTruthy();
  const shader = effect.makeShaderWithChildren([0, 0, band], [child]);
  const paint = Skia.Paint();
  const filter = Skia.ColorFilter.MakeBlend(Skia.Color('#804020'), BlendMode.Modulate);
  paint.setShader(shader); paint.setColorFilter(filter);
  const surface = Skia.Surface.Make(2, 1)!;
  surface.getCanvas().drawPaint(paint); surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const actual = snapshot.readPixels(0, 0, rgba)!;
  const expected = [128 * 192 / 255, 64 * 192 / 255, 32 * 192 / 255, 128];
  expected.forEach((value, channel) => expect(Math.abs(actual[channel] - value)).toBeLessThanOrEqual(2));
  expect(actual[7]).toBe(0);
  [snapshot, surface, filter, paint, shader, effect, child, img].forEach((resource) => resource.dispose());
});

test('mask shader samples the frame offset rather than the atlas origin', () => {
  const rgba = { width: 2, height: 1, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const img = Skia.Image.MakeImage(rgba, Skia.Data.fromBytes(Uint8Array.from([0,0,0,0, 85,128,255,255])), 8)!;
  const child = img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None);
  const effect = Skia.RuntimeEffect.Make(STRIPE_MASK_SKSL)!;
  const shader = effect.makeShaderWithChildren([1, 0, 2], [child]);
  const paint = Skia.Paint(); paint.setShader(shader);
  const surface = Skia.Surface.Make(1, 1)!;
  surface.getCanvas().drawPaint(paint); surface.flush();
  const snapshot = surface.makeImageSnapshot();
  expect(Array.from(snapshot.readPixels(0, 0, { ...rgba, width: 1 })!)).toEqual([255,255,255,255]);
  [snapshot, surface, paint, shader, effect, child, img].forEach((resource) => resource.dispose());
});
