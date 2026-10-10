import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as Native from 'react-native';
import { KitDeck } from './KitDeck';
import { SavedKit } from './SavedKit';
import { OATMEAL_STOCK } from '@/theme/materials';
import { kitFixture } from '../../tests/fixtures';

afterEach(() => jest.restoreAllMocks());

test.each([{ width: 390, height: 844 }, { width: 375, height: 667 }])('Saved paints each back chip’s own color along its exposed lower edge at $width', async (screen) => {
  jest.spyOn(Native.Dimensions, 'get').mockReturnValue({ ...screen, scale: 3, fontScale: 1 });
  const view = await render(<SavedKit kit={kitFixture} failed={false} onError={() => {}}
    placeholder={null} onEdit={() => {}} disabled={false} maxHeight={screen.height - 351} />);
  const composition = StyleSheet.flatten(view.getByTestId('saved-composition').props.style);
  const scaledContent = view.getByTestId('saved-composition').children[0];
  if (typeof scaledContent === 'string') throw new Error('Missing saved content');
  const scale = StyleSheet.flatten(scaledContent.props.style).transform[0].scale;
  const deckStyle = StyleSheet.flatten(view.getByTestId('closed-kit-deck').props.style);
  const deckScale = deckStyle.transform[0].scale;
  const deckRotation = parseFloat(composition.transform[0].rotate) * Math.PI / 180;
  const surface = Skia.Surface.Make(500, 700)!;
  const canvas = surface.getCanvas();
  canvas.translate(80, 40);
  canvas.rotate(deckRotation * 180 / Math.PI, 0, 0);
  canvas.scale(scale * deckScale * 3, scale * deckScale * 3);
  const paint = Skia.Paint();
  const samples: { x: number; y: number; color: string }[] = [];
  // Paint the rendered cards in their stacking order. Use the real View
  // styles and transforms, then sample below the swatch/label boundary;
  // a short strip or one hidden by the next card fails this pixel check.
  for (const card of view.getByTestId('closed-kit-deck').children.slice(0, 6)) {
    if (typeof card === 'string') throw new Error('Missing card');
    const style = StyleSheet.flatten(card.props.style);
    const face = card.children[0];
    if (typeof face === 'string') throw new Error('Missing stock');
    const faceStyle = StyleSheet.flatten(face.props.style);
    const [pivotX, pivotY] = style.transformOrigin.split(' ').map(parseFloat);
    const angle = parseFloat(style.transform[0].rotate) * Math.PI / 180;
    canvas.save();
    canvas.translate(style.left, style.top);
    canvas.rotate(angle * 180 / Math.PI, pivotX, pivotY);
    paint.setColor(Skia.Color(faceStyle.backgroundColor));
    canvas.drawRect(Skia.XYWHRect(0, 0, faceStyle.width, faceStyle.minHeight), paint);
    const edge = card.children[1];
    if (edge && typeof edge !== 'string') {
      const edgeStyle = StyleSheet.flatten(edge.props.style);
      const edgeHeight = edgeStyle.height ?? faceStyle.minHeight - edgeStyle.top - edgeStyle.bottom;
      paint.setColor(Skia.Color(edgeStyle.backgroundColor));
      canvas.drawRect(Skia.XYWHRect(edgeStyle.left, edgeStyle.top, edgeStyle.width, edgeHeight), paint);
      const x = 2 - pivotX, y = 150 - pivotY;
      samples.push({ x: style.left + pivotX + x * Math.cos(angle) - y * Math.sin(angle),
        y: style.top + pivotY + x * Math.sin(angle) + y * Math.cos(angle), color: edgeStyle.backgroundColor });
    }
    canvas.restore();
  }
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const pixels = snapshot.readPixels(0, 0, { width: 500, height: 700,
    colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!;
  expect(samples).toHaveLength(5);
  for (const sample of samples) {
    const x = sample.x * scale * deckScale * 3, y = sample.y * scale * deckScale * 3;
    const px = Math.round(80 + x * Math.cos(deckRotation) - y * Math.sin(deckRotation));
    const py = Math.round(40 + x * Math.sin(deckRotation) + y * Math.cos(deckRotation));
    const actual = Array.from(pixels.slice((py * 500 + px) * 4, (py * 500 + px) * 4 + 3));
    expect(actual).toEqual(sample.color.slice(1).match(/../g)!.map((hex) => parseInt(hex, 16)));
  }
  snapshot.dispose(); surface.dispose();
});

test('empty roles use oatmeal stock and filled roles retain their distinct edge colors', async () => {
  const view = await render(<KitDeck kit={kitFixture} closed />);
  expect(view.getByTestId('deck-edge-accent')).toHaveStyle({ backgroundColor: OATMEAL_STOCK });
  for (const role of ['text', 'surface', 'background', 'secondary'] as const) {
    expect(view.getByTestId(`deck-edge-${role}`)).toHaveStyle({ backgroundColor: kitFixture.roles[role]! });
  }
});

test('the saved brass pin sits at the top edge, above the Primary label even with large text', async () => {
  const view = await render(<KitDeck kit={kitFixture} closed typeSize={22} />);
  const rivet = StyleSheet.flatten(view.getByTestId('deck-rivet').props.style);
  expect(rivet.top).toBeLessThanOrEqual(0);
  expect(rivet.top + 23).toBeLessThan(168 * 0.7);
});
