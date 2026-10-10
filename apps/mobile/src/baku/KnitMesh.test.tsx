import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AlphaType, ColorType, Skia, Group, Rect, Image as SkiaImage } from '@shopify/react-native-skia';
import { type SharedValue } from 'react-native-reanimated';
import * as Reanimated from 'react-native-reanimated';
import { act } from '@testing-library/react-native';
import { emptyRoles } from '@inzpo/shared';
import { KnitMesh } from './KnitBaku';
import { DustCloud } from './DustIntake';
import { balloonFlight, hostDurationFor, HOST_FLIGHT } from './host-motion';
import { anticipationAt, TIMING } from './motion';
import { chipFlight } from './transport';
import { resultLayout } from '../lib/result-layout';
import type { PalettePerformance } from './usePalettePerformance';

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

// A CanvasKit composition check of the shipping mesh and dust JSX. Rectangles
// stand in for native stock controls; these are not iPhone screenshots.
test('intake and balloon frames render at compact and standard phone widths', async () => {
  const derived = jest.spyOn(Reanimated, 'useDerivedValue').mockImplementation(updater =>
    ({ value: updater(), _isReanimatedSharedValue: true }) as unknown as ReturnType<typeof Reanimated.useDerivedValue>);
  const value = (n: number) => ({ value: n }) as SharedValue<number>;
  const images = ['neutral', 'cheeks', 'squeeze', 'pleased', 'coat-material'].map(name =>
    Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(readFileSync(resolve(__dirname, `../../assets/baku-performance/${name}.webp`))))!);
  const photo = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(readFileSync(resolve(__dirname, '../../../../public/sample/IMG_6505.jpg'))))!;
  const roles = { ...emptyRoles(), primary: '#d6d3af', secondary: '#615343', background: '#eee9d9', text: '#202421' };
  const release = anticipationAt(8) + TIMING.anticipation;
  const frames = [
    { name: 'intake', time: 0, ready: -1, intake: 1 },
    { name: 'chew', time: 4, ready: -1, intake: 0 },
    { name: 'sneeze', time: release + .2, ready: 8, intake: 0 },
    { name: 'balloon-a', time: release + HOST_FLIGHT.delay + .45, ready: 8, intake: 0 },
    { name: 'balloon-b', time: release + HOST_FLIGHT.delay + 1, ready: 8, intake: 0 },
    { name: 'corner', time: hostDurationFor(8) + .01, ready: 8, intake: 0 },
  ];
  for (const width of [375, 390]) {
    const height = width === 375 ? 667 : 844;
    const layout = resultLayout({ width, height, topInset: width === 375 ? 20 : 47, bottomInset: width === 375 ? 0 : 34 });
    const bakuWidth = Math.min(280, width * .76);
    const origin = { x: width - bakuWidth + 8, y: layout.printTop + layout.printHeight - 100, width: bakuWidth };
    const target = { x: 10, y: height - layout.footerBottom + 8 - 48, width: 72 };
    const printLeft = (width - layout.printWidth) / 2;
    for (const frame of frames) {
      const flight = balloonFlight(frame.time, frame.ready, origin, target, .43, { width, height });
      const performance = { elapsed: value(frame.time), readyAt: value(frame.ready), intakeElapsed: value(1.2), intakeBlend: value(frame.intake) } as PalettePerformance;
      const root = new SkiaSGRoot(Skia);
      await act(async () => { void root.render(<>
        <Rect x={0} y={0} width={width} height={height} color="#F3EEE4" />
        <Rect x={printLeft} y={layout.printTop} width={layout.printWidth} height={layout.printHeight} color="#FFFCF5" />
        <SkiaImage image={photo} x={printLeft + 13} y={layout.printTop + 13} width={layout.printWidth - 26} height={layout.photoHeight} fit="cover" />
        {layout.slots.map((slot, i) => {
          const end = { x: slot.x + 20 + slot.width / 2, y: layout.pileTop + slot.y + slot.height / 2 };
          const chip = chipFlight(frame.time, frame.ready, origin, end, i);
          const color = roles[slot.role];
          return <Group key={slot.role} opacity={color ? chip.opacity : chip.blankOpacity}
            transform={[{ translateX: color ? chip.x : end.x }, { translateY: color ? chip.y : end.y },
              { rotate: (slot.rotation + (color ? chip.rotation : 0)) * Math.PI / 180 }, { scale: color ? chip.scale : 1 }]}>
            <Rect x={-slot.width / 2} y={-slot.height / 2} width={slot.width} height={slot.height} color="#FFFCF5" />
            <Rect x={-slot.width / 2 + 2} y={-slot.height / 2 + 2} width={slot.width - 4} height={slot.height * .7} color={color ?? '#E4D9C6'} />
          </Group>;
        })}
        <DustCloud source={{ x: printLeft + layout.printWidth * .18, y: layout.printTop + layout.printHeight * .83 }} baku={origin} performance={performance} />
        <Group transform={[{ translateX: flight.x }, { translateY: flight.y }, { rotate: flight.rotation * Math.PI / 180 },
          { scale: flight.scale }, { translateX: -bakuWidth / 2 }, { translateY: -bakuWidth / 3 }]}>
          <KnitMesh width={bakuWidth} images={images} roles={roles} elapsed={performance.elapsed} readyAt={performance.readyAt}
            intakeElapsed={performance.intakeElapsed} intakeBlend={performance.intakeBlend} />
        </Group>
      </>); });
      const surface = Skia.Surface.Make(width, height)!;
      root.drawOnCanvas(surface.getCanvas()); surface.flush();
      const image = surface.makeImageSnapshot();
      const pixels = new Uint8Array(image.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!);
      // The head/body is darker than the paper even at the 72pt endpoint.
      let hostPixels = 0;
      const radius = bakuWidth * flight.scale / 3;
      for (let y = Math.max(0, Math.floor(flight.y - radius)); y < Math.min(height, flight.y + radius); y++)
        for (let x = Math.max(0, Math.floor(flight.x - radius)); x < Math.min(width, flight.x + radius); x++)
          if (pixels[(y * width + x) * 4] < 180) hostPixels++;
      expect(hostPixels).toBeGreaterThan(90);
      if (process.env.BAKU_CAPTURE_DIR) {
        mkdirSync(process.env.BAKU_CAPTURE_DIR, { recursive: true });
        writeFileSync(resolve(process.env.BAKU_CAPTURE_DIR, `host-${width}-${frame.name}.png`), image.encodeToBytes());
      }
      await act(async () => { void root.unmount(); });
      image.dispose(); surface.dispose();
    }
  }
  images.forEach(image => image.dispose()); photo.dispose(); derived.mockRestore();
}, 45000);
