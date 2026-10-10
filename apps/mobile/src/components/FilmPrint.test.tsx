import { act, render } from '@testing-library/react-native';
import { AlphaType, ColorType, Group, Skia } from '@shopify/react-native-skia';
import { FilmPrint } from './FilmPrint';
import { kitFixture } from '../../tests/fixtures';
import { photoPins } from '@/lib/result-pins';
import { resultLayout } from '@/lib/result-layout';

jest.mock('@shopify/react-native-skia/lib/module/sksg/Container', () =>
  jest.requireActual('@shopify/react-native-skia/lib/module/sksg/Container.js'));

const { drawAsPicture } = jest.requireActual<typeof import('@shopify/react-native-skia')>(
  '@shopify/react-native-skia/lib/module/renderer/Offscreen',
);

test.each([{ width: 390, height: 844 }, { width: 375, height: 667 }])('all four role rings and dots actually paint at $width, with coincident bottom samples', async (screen) => {
  const roles = { ...kitFixture.roles, surface: null };
  const filledRoles = ['primary', 'secondary', 'background', 'text'] as const;
  const kit = { ...kitFixture, roles, colors: filledRoles.map((role) => ({
    role, hex: roles[role]!, name: null, origin: 'sampled', pinX: 0.5, pinY: 0.95,
  })) };
  const layout = resultLayout(screen);
  const view = await render(<FilmPrint kit={kit} width={layout.printWidth} height={layout.printHeight} pinHeight={layout.pinHeight}
    failed={false} onError={() => {}} onPinPress={() => {}} placeholder={null} />);
  expect(view.getAllByTestId(/^photo-pin-/)).toHaveLength(Object.values(roles).filter(Boolean).length);
  const canvas = view.getByTestId('photo-pins').children[0];
  if (typeof canvas === 'string') throw new Error('Missing pin canvas');
  // Draw FilmPrint's actual scene through the installed Skia reconciler.
  let paint!: ReturnType<typeof drawAsPicture>;
  await act(async () => { paint = drawAsPicture(<Group transform={[{ scale: 3 }]}>{canvas.props.children}</Group>); });
  const picture = await paint;
  const width = Math.ceil((layout.printWidth - 26) * 3), height = Math.ceil(layout.photoHeight * 3);
  const surface = Skia.Surface.Make(width, height)!;
  surface.getCanvas().drawPicture(picture);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const pixels = snapshot.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!;
  const pins = photoPins(kit, layout.printWidth - 26, layout.photoHeight, layout.pinHeight);
  for (const pin of pins) {
    const x = Math.round(pin.marker.x * 3), y = Math.round(pin.marker.y * 3);
    const actual = Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
    const expected = pin.color.slice(1).match(/../g)!.map((hex) => parseInt(hex, 16));
    expect(actual).toEqual(expected);
    // Ring ink must exist around each dot, not just its invisible hit target.
    let ringPixels = 0;
    for (let dy = -25; dy <= 25; dy++) for (let dx = -25; dx <= 25; dx++) {
      if (Math.hypot(dx, dy) < 12 || Math.hypot(dx, dy) > 25) continue;
      const at = ((y + dy) * width + x + dx) * 4;
      if (pixels[at + 3] > 240 && pixels[at] < 40 && pixels[at + 1] < 40 && pixels[at + 2] < 40) ringPixels++;
    }
    expect(ringPixels).toBeGreaterThan(50);
  }
  [snapshot, surface, picture].forEach((resource) => resource.dispose());
});
