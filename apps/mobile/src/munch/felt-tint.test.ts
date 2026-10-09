import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FELT_TINT_SKSL } from './felt-tint';

const { Skia, AlphaType, ColorType, TileMode, FilterMode, MipmapMode } =
  jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

test.each([1, 2, 3])('actual chewing pixels shift tan felt to cream and preserve yarn, eyes, blush and alpha at %sx', (density) => {
  const suffix = density === 1 ? '' : `@${density}x`;
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(
    readFileSync(resolve(__dirname, `../../assets/munch/still${suffix}.png`)),
  ))!;
  const width = image.width(), height = image.height();
  const info = { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const child = image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None);
  const effect = Skia.RuntimeEffect.Make(FELT_TINT_SKSL)!;
  const shader = effect.makeShaderWithChildren([width, 0, 0], [child]);
  const surface = Skia.Surface.Make(width, height)!;
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const before = image.readPixels(0, 0, info)!;
  const after = snapshot.readPixels(0, 0, info)!;
  const at = (x: number, y: number) => (Math.floor(y * density) * width + Math.floor(x * density)) * 4;
  for (const [x, y] of [[80, 126], [158, 90]]) {
    const i = at(x, y);
    expect(after[i + 1]).toBeGreaterThan(before[i + 1] + 10);
    expect(after[i] - after[i + 2]).toBeLessThan(before[i] - before[i + 2] - 10);
  }
  for (const [x, y] of [[18, 95], [120, 50], [65, 75]]) {
    const i = at(x, y);
    for (let c = 0; c < 4; c++) expect(Math.abs(after[i + c] - before[i + c])).toBeLessThanOrEqual(2);
  }
  let alphaError = 0;
  for (let i = 3; i < before.length; i += 4) alphaError = Math.max(alphaError, Math.abs(after[i] - before[i]));
  expect(alphaError).toBeLessThanOrEqual(1);
  [snapshot, paint, shader, effect, surface, child, image].forEach((resource) => resource.dispose());
});
