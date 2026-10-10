import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { type SharedValue } from 'react-native-reanimated';
import * as Reanimated from 'react-native-reanimated';
import { act } from '@testing-library/react-native';
import { emptyRoles } from '@inzpo/shared';
import { KnitMesh } from './KnitBaku';

// The package's Jest mock replaces drawAsPicture with a no-op. Use the actual
// reconciler/paint visitor: an imperative drawVertices test misses paint props.
jest.mock('@shopify/react-native-skia/lib/module/sksg/Container', () => ({
  createContainer: (skia: typeof Skia, nativeId: number) => {
    const { StaticContainer } = jest.requireActual('@shopify/react-native-skia/lib/module/sksg/StaticContainer');
    return new StaticContainer(skia, nativeId);
  },
}));
const { SkiaSGRoot } = jest.requireActual('@shopify/react-native-skia/lib/module/sksg/Reconciler');

test('the shipping JSX mesh paints Baku before colors and during the reveal', async () => {
  // Give the official Reanimated mock the marker used by Skia's recorder to
  // unwrap shared values; the native runtime supplies this marker itself.
  const derived = jest.spyOn(Reanimated, 'useDerivedValue').mockImplementation((updater) =>
    ({ value: updater(), _isReanimatedSharedValue: true }) as unknown as ReturnType<typeof Reanimated.useDerivedValue>);
  const images = ['neutral', 'cheeks', 'squeeze', 'pleased', 'coat-material'].map(name =>
    Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(
      readFileSync(resolve(__dirname, `../../assets/baku-performance/${name}.webp`)),
    )))!);
  const width = 480, height = 320;
  for (const [time, ready] of [[0, -1], [8, -1], [8.6, 8], [9.1, 8]]) {
    const root = new SkiaSGRoot(Skia);
    await act(async () => { void root.render(<KnitMesh width={width} images={images} elapsed={({ value: time } as SharedValue<number>)} readyAt={({ value: ready } as SharedValue<number>)}
      roles={ready < 0 ? emptyRoles() : { ...emptyRoles(), primary: '#d6d3af', secondary: '#615343', text: '#202421' }} />); });
    const surface = Skia.Surface.Make(width, height)!;
    root.drawOnCanvas(surface.getCanvas());
    surface.flush();
    const image = surface.makeImageSnapshot();
    const pixels = new Uint8Array(image.readPixels(0, 0, { width, height,
      colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!);
    let painted = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 200) painted++;
    if (process.env.BAKU_CAPTURE_DIR) {
      mkdirSync(process.env.BAKU_CAPTURE_DIR, { recursive: true });
      writeFileSync(resolve(process.env.BAKU_CAPTURE_DIR, `jsx-mesh-${time.toFixed(1)}.png`), image.encodeToBytes());
    }
    await act(async () => { void root.unmount(); });
    image.dispose(); surface.dispose();
    expect(painted).toBeGreaterThan(7500);
  }
  images.forEach(image => image.dispose());
  derived.mockRestore();
}, 15000);
