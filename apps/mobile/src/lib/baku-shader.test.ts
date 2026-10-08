import { BAKU_TINT_SKSL } from '@/components/BakuTinted';
import { dyeCoverage, OATMEAL_RGB, STRIPE_FEATHER, tintPixel, type Rgba01, type WipeMode } from './baku-tint';

const { Skia, AlphaType, ColorType, TileMode, FilterMode, MipmapMode } =
  jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

// Render real image child shaders through the official CanvasKit-backed mock.
// Sample every row at 48pt, including the feather, to catch direction, grayscale
// channels, premultiplication, shade clamping and uniform-order mistakes.
test.each([
  { band: 0, shade: 128, coverage: 255, alpha: 255, progress: 1, mode: 0, empty: false },
  { band: 1, shade: 255, coverage: 255, alpha: 128, progress: 1, mode: 0, empty: false },
  { band: 2, shade: 64, coverage: 128, alpha: 192, progress: 1, mode: 0, empty: false },
  { band: 3, shade: 200, coverage: 255, alpha: 255, progress: 0, mode: 0, empty: false },
  { band: 4, shade: 64, coverage: 128, alpha: 192, progress: 0, mode: 0, empty: false },
  ...Array.from({ length: 6 }, (_, band) => ({ band, shade: 160, coverage: 192, alpha: 160, progress: 0.5, mode: 0, empty: false })),
  { band: 5, shade: 255, coverage: 255, alpha: 128, progress: 0.5, mode: 1, empty: false },
  { band: 3, shade: 64, coverage: 128, alpha: 192, progress: 0.25, mode: 1, empty: false },
  { band: 2, shade: 128, coverage: 255, alpha: 255, progress: 0, mode: 0, empty: true },
  { band: 2, shade: 64, coverage: 128, alpha: 192, progress: 0.5, mode: 1, empty: true },
])('SkSL pixels match oatmeal-to-role dye: %j', ({ band, shade, coverage, alpha, progress, mode, empty }) => {
  const rgba = { width: 1, height: 1, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const image = (bytes: number[]) => Skia.Image.MakeImage(rgba, Skia.Data.fromBytes(Uint8Array.from(bytes)), 4)!;
  const gray = (value: number) => image([value, value, value, 255]);
  const baseBytes = [102, 128, 153, alpha];
  const images = [image(baseBytes), gray(shade), ...Array.from({ length: 6 }, (_, i) => gray(i === band ? coverage : 0))];
  const children = images.map((img) => img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None));
  const colors = Array.from({ length: 6 }, (_, i) => empty && i === band ? OATMEAL_RGB : [0.2 + i * 0.1, 0.8 - i * 0.1, 0.3] as const);
  const effect = Skia.RuntimeEffect.Make(BAKU_TINT_SKSL)!;
  const bounds = [0.25, 0.75] as const;
  const height = 48;
  const shader = effect.makeShaderWithChildren([
    ...colors.flat(), ...Array(6).fill(progress), ...Array.from({ length: 6 }, () => bounds).flat(), height, mode,
  ], children);
  const surface = Skia.Surface.Make(1, height)!;
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const actual = snapshot.readPixels(0, 0, { ...rgba, height })!;
  for (let row = 0; row < height; row++) {
    const dye = dyeCoverage((row + 0.5) / height, bounds[0], bounds[1], progress, mode as WipeMode);
    const expected = tintPixel(baseBytes.map((value) => value / 255) as unknown as Rgba01, shade, coverage / 255, colors[band], dye);
    expected.forEach((value, channel) => expect(Math.abs(actual[row * 4 + channel] - value * 255)).toBeLessThanOrEqual(2));
  }
  [snapshot, paint, shader, effect, surface, ...children, ...images].forEach((resource) => resource.dispose());
});

test('the normalized wipe feather spans three points at 48pt', () => {
  expect(STRIPE_FEATHER * 2 * 48).toBe(3);
});
