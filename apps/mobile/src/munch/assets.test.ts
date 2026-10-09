import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { Skia, AlphaType, ColorType } =
  jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

test.each([1, 2, 3])('chewing cutout has antialiased feet, no floor and a blush tip at %sx', (density) => {
  const suffix = density === 1 ? '' : `@${density}x`;
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(
    readFileSync(resolve(__dirname, `../../assets/munch/still${suffix}.png`)),
  ))!;
  const width = image.width(), height = image.height();
  expect([width, height]).toEqual([176 * density, 144 * density]);
  const bytes = image.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!;
  image.dispose();
  const at = (x: number, y: number) => (Math.floor(y * density) * width + Math.floor(x * density)) * 4;
  // Below all three feet there is transparent air, not a paper/shadow strip.
  for (let y = height - 3 * density; y < height; y++) for (let x = 0; x < width; x++) {
    expect(bytes[(y * width + x) * 4 + 3]).toBeLessThan(8);
  }
  let antialiased = 0;
  for (let y = 112 * density; y < 140 * density; y++) for (let x = 0; x < width; x++) {
    const alpha = bytes[(y * width + x) * 4 + 3];
    if (alpha > 8 && alpha < 247) antialiased++;
  }
  expect(antialiased).toBeGreaterThan(20 * density);
  // Tip is softly pink: red exceeds green, which exceeds blue; no green dye.
  const tip = at(18, 95);
  expect(bytes[tip + 3]).toBeGreaterThan(245);
  expect(bytes[tip] - bytes[tip + 1]).toBeGreaterThan(8);
  expect(bytes[tip + 1]).toBeGreaterThan(bytes[tip + 2]);
});
