import { BAKU_TINT_SKSL } from '@/components/BakuTinted';
import { dyeCoverage, OATMEAL_RGB, STRIPE_FEATHER, tintPixel, type Rgba01, type WipeMode } from './baku-tint';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakuEyes, type BakuEye } from './baku-eyes';
import { pupilPixel, type PupilVector } from './baku-pupils';

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
    0, ...Array(8).fill(0), ...Array(6).fill(0), 0, 0, 144,
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

// Verify the eye pass in real compiled SkSL against the JS reference, rather
// than only checking source strings or the native-module mock's props.
function renderEyes(base: ReturnType<typeof Skia.Image.MakeImage>, eyes: readonly BakuEye[], offset: PupilVector) {
  const height = 144;
  const rgba = { width: height, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const solid = (v: number) => Skia.Image.MakeImage({ ...rgba, width: 1, height: 1 }, Skia.Data.fromBytes(Uint8Array.from([v, v, v, 255])), 4)!;
  const shade = solid(128), mask = solid(0);
  const children = [base!, shade, mask, mask, mask, mask, mask, mask].map((img) =>
    img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None));
  const table = [0, 1].flatMap((i) => eyes[i] ? [eyes[i].cx, eyes[i].cy, eyes[i].pupilR, eyes[i].whiteR] : [0, 0, 0, 0]);
  const colors = [0, 1].flatMap((i) => eyes[i]?.whiteColor ?? [0, 0, 0]);
  const effect = Skia.RuntimeEffect.Make(BAKU_TINT_SKSL)!;
  const shader = effect.makeShaderWithChildren([
    ...Array(18).fill(0), ...Array(6).fill(1), ...Array(12).fill(0), height, 0,
    eyes.length, ...table, ...colors, offset.x, offset.y, height,
  ], children);
  const surface = Skia.Surface.Make(height, height)!;
  const paint = Skia.Paint(); paint.setShader(shader);
  surface.getCanvas().drawPaint(paint); surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const actual = snapshot.readPixels(0, 0, rgba)!;
  [snapshot, paint, surface, shader, effect, shade, mask, ...children].forEach((resource) => resource.dispose());
  return actual;
}

test.each([{ x: 0, y: 0 }, { x: 2, y: -1 }, { x: 1000, y: -1000 }, { x: 0.1, y: 0.2 }])('SkSL pupil sampling, highlight, fill and feather match JS: %j', (offset) => {
  const size = 144;
  const eye: BakuEye = { cx: 0.5, cy: 0.5, pupilR: 6 / size, whiteR: 12 / size, whiteColor: [0.9, 0.9, 0.9] };
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const pupil = Math.hypot(x + 0.5 - 72, y + 0.5 - 72) < 5;
    const highlight = Math.hypot(x + 0.5 - 70, y + 0.5 - 70) < 1;
    const inside = Math.hypot(x + 0.5 - 72, y + 0.5 - 72) < 12;
    pixels.set([...(highlight ? [255, 255, 255] : pupil ? [20, 25, 30] : inside ? [230, 230, 230] : [140, 120, 100]), 255], (y * size + x) * 4);
  }
  const rgba = { width: size, height: size, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const base = Skia.Image.MakeImage(rgba, Skia.Data.fromBytes(pixels), size * 4)!;
  const sample = ({ x, y }: PupilVector) => {
    const at = (Math.min(size - 1, Math.max(0, Math.floor(y))) * size + Math.min(size - 1, Math.max(0, Math.floor(x)))) * 4;
    return [pixels[at] / 255, pixels[at + 1] / 255, pixels[at + 2] / 255] as const;
  };
  const actual = renderEyes(base, [eye], offset);
  let maximumError = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const expected = pupilPixel({ x: x + 0.5, y: y + 0.5 }, eye, offset, size, sample);
    expected.forEach((v, channel) => { maximumError = Math.max(maximumError, Math.abs(actual[(y * size + x) * 4 + channel] - v * 255)); });
    expect(actual[(y * size + x) * 4 + 3]).toBe(255);
  }
  expect(maximumError).toBeLessThanOrEqual(offset.x === 0 && offset.y === 0 ? 0 : 2);
  base.dispose();
});

test.each(['idle', 'chewing', 'success', 'errorBrief'] as const)('%s zero-offset shader reproduces the actual base sprite', (pose) => {
  const asset = pose === 'errorBrief' ? 'error-brief' : pose;
  const base = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(readFileSync(resolve(__dirname, `../../assets/baku-v6/baku-${asset}@3x.png`))))!;
  const rgba = { width: 144, height: 144, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const expected = base.readPixels(0, 0, rgba)!;
  const actual = renderEyes(base, bakuEyes[pose], { x: 0, y: 0 });
  expect(Array.from(actual)).toEqual(Array.from(expected));
  base.dispose();
});

test.each(['success', 'errorBrief', 'errorPhoto'] as const)('%s ignores nonzero pupil offsets, including closed arcs and nose/feet shadows', (pose) => {
  const asset = pose === 'errorBrief' ? 'error-brief' : pose === 'errorPhoto' ? 'error-photo' : pose;
  const base = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(readFileSync(resolve(__dirname, `../../assets/baku-v6/baku-${asset}@3x.png`))))!;
  const rgba = { width: 144, height: 144, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  expect(Array.from(renderEyes(base, bakuEyes[pose], { x: 100, y: -100 }))).toEqual(Array.from(base.readPixels(0, 0, rgba)!));
  base.dispose();
});
