import { fireEvent, render } from '@testing-library/react-native';
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StyleSheet } from 'react-native';
import { PrimaryArrow } from './PrimaryArrow';
import { resultLayout } from '@/lib/result-layout';
import { CANVAS } from '@/theme/tokens';

test.each([{ width: 390, height: 844 }, { width: 375, height: 667 }])('the actual Caveat glyphs fit beside the photo at $width', async (screen) => {
  const layout = resultLayout(screen);
  const heroWidth = layout.contentWidth + 40;
  const photoLeft = (heroWidth - layout.printWidth) / 2 + 13;
  const view = await render(<PrimaryArrow width={heroWidth} height={layout.heroHeight} photoLeft={photoLeft}
    start={{ x: 32, y: 300 }} end={{ x: 140, y: 150 }} hue="yellow"
    progress={{ value: 1 } as never} reducedMotion />);
  const text = view.getByText('This yellow.');
  const textStyle = StyleSheet.flatten(text.props.style);
  const data = Skia.Data.fromBytes(readFileSync(resolve(__dirname, '../../assets/fonts/Caveat.ttf')));
  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data)!;
  const font = Skia.Font(typeface, textStyle.fontSize);
  const advance = font.getGlyphWidths(font.getGlyphIDs('This yellow.')).reduce((sum, value) => sum + value, 0);
  await fireEvent(text, 'textLayout', { nativeEvent: { lines: [{ width: advance }] } });
  const captionStyle = StyleSheet.flatten(view.getByTestId('primary-caption').props.style);
  const left = captionStyle.left as number;
  // A wide Text container alone did not fix this: at 390 its last glyphs
  // landed on the dark photo. Check the loaded font's painted bounds too.
  expect(left + advance + textStyle.paddingRight).toBeLessThanOrEqual(photoLeft);
  expect(StyleSheet.flatten(view.getByText('This yellow.').props.style).backgroundColor).toBe('transparent');
  if (screen.width === 375) expect(left).toBe(16);
  const surface = Skia.Surface.Make(screen.width * 3, 26 * 3)!;
  const canvas = surface.getCanvas();
  canvas.scale(3, 3);
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('#1C1B19'));
  canvas.drawText('This yellow.', left, 20, paint, font);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const pixels = snapshot.readPixels(0, 0, { width: screen.width * 3, height: 26 * 3,
    colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!;
  const paintedX: number[] = [];
  for (let y = 0; y < 26 * 3; y++) for (let x = 0; x < screen.width * 3; x++) {
    if (pixels[(y * screen.width * 3 + x) * 4 + 3] > 128) paintedX.push(x / 3);
  }
  expect(paintedX.length).toBeGreaterThan(100);
  expect(Math.min(...paintedX)).toBeGreaterThanOrEqual(4);
  expect(Math.max(...paintedX)).toBeLessThan(photoLeft);
  snapshot.dispose(); surface.dispose();
});

test('a long hue or enlarged text keeps a canvas backing when it outgrows the gutter', async () => {
  const view = await render(<PrimaryArrow width={390} height={600} photoLeft={71}
    start={{ x: 32, y: 300 }} end={{ x: 140, y: 150 }} hue="yellow-green"
    progress={{ value: 1 } as never} reducedMotion />);
  await fireEvent(view.getByText('This yellow-green.'), 'textLayout', { nativeEvent: { lines: [{ width: 160 }] } });
  expect(view.getByText('This yellow-green.')).toHaveStyle({ backgroundColor: CANVAS });
  expect(view.getByTestId('primary-caption')).toHaveStyle({ left: 4, width: 370 });
});
