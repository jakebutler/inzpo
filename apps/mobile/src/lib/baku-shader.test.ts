import { BAKU_TINT_SKSL } from '@/components/BakuTinted';
import { tintPixel, type Rgba01 } from './baku-tint';

const { Skia, AlphaType, ColorType, TileMode, FilterMode, MipmapMode } =
  jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

// Render real image child shaders through the official CanvasKit-backed mock.
// This catches grayscale-channel, premultiplication and uniform-order mistakes.
test.each([
  { band: 0, shade: 128, coverage: 255, alpha: 255, revealed: 1 },
  { band: 2, shade: 255, coverage: 255, alpha: 128, revealed: 1 },
  { band: 5, shade: 64, coverage: 128, alpha: 192, revealed: 1 },
  { band: 3, shade: 200, coverage: 255, alpha: 255, revealed: 0 },
])('SkSL pixels match the JS formula: %j', ({ band, shade, coverage, alpha, revealed }) => {
  const rgba = { width: 1, height: 1, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const image = (bytes: number[]) => Skia.Image.MakeImage(rgba, Skia.Data.fromBytes(Uint8Array.from(bytes)), 4)!;
  const gray = (value: number) => image([value, value, value, 255]);
  const baseBytes = [102, 128, 153, alpha];
  const images = [image(baseBytes), gray(shade), ...Array.from({ length: 6 }, (_, i) => gray(i === band ? coverage : 0))];
  const children = images.map((img) => img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None));
  const colors = Array.from({ length: 6 }, (_, i) => [0.2 + i * 0.1, 0.8 - i * 0.1, 0.3] as const);
  const effect = Skia.RuntimeEffect.Make(BAKU_TINT_SKSL)!;
  const shader = effect.makeShaderWithChildren([...colors.flat(), ...Array(6).fill(revealed)], children);
  const surface = Skia.Surface.Make(1, 1)!;
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const actual = snapshot.readPixels(0, 0, rgba)!;
  const expected = tintPixel(baseBytes.map((value) => value / 255) as unknown as Rgba01, shade, coverage / 255 * revealed, colors[band]);
  expected.forEach((value, index) => expect(Math.abs(actual[index] - value * 255)).toBeLessThanOrEqual(2));
  [snapshot, paint, shader, effect, surface, ...children, ...images].forEach((resource) => resource.dispose());
});
