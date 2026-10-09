import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AlphaType, BlendMode, ColorType, FilterMode, MipmapMode, Skia, TileMode, VertexMode } from '@shopify/react-native-skia';
import { KNIT_SHADER } from './shader';
import { coatFillAt, deform, poseAt, SNOUT, durationFor } from './motion';

test('native SkSL renders the registered knit mesh and leaves empty panels undyed', () => {
  const images = ['neutral', 'cheeks', 'squeeze', 'pleased', 'coat-material'].map(name => {
    const bytes = readFileSync(resolve(__dirname, `../../assets/baku-performance/${name}.webp`));
    return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(bytes)))!;
  });
  const shaders = images.map(img => img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None,
    Skia.Matrix().scale(1 / img.width(), 1 / img.height())));
  const effect = Skia.RuntimeEffect.Make(KNIT_SHADER);
  expect(effect).not.toBeNull();
  const columns = 48, rows = 32, width = 780, height = 520;
  const uv = Array.from({ length: (columns + 1) * (rows + 1) }, (_, i) => ({ x: i % (columns + 1) / columns, y: Math.floor(i / (columns + 1)) / rows }));
  const indices: number[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const i = y * (columns + 1) + x;
    indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
  }
  const palette = ['#d6d3af', '#615343', null, '#eee9d9', null, '#202421'].flatMap(hex => hex
    ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1) : [.61, .61, .61, 0]);
  const frames: Uint8Array[] = [];
  for (const time of [0, .8, 2, 3.1, 3.24, durationFor(0)]) {
    const pose = poseAt(time, 0);
    const vertices = Skia.MakeVertices(VertexMode.Triangles, uv.map(p => {
      const point = deform(p.x, p.y, pose); return { x: point.x * width, y: point.y * height };
    }), uv, undefined, indices)!;
    const shader = effect!.makeShaderWithChildren([pose.fullness, pose.closed, pose.happy, coatFillAt(time, 0), ...palette], shaders);
    const paint = Skia.Paint(); paint.setShader(shader);
    const surface = Skia.Surface.Make(width, height)!;
    surface.getCanvas().drawVertices(vertices, BlendMode.Dst, paint);
    surface.flush();
    const image = surface.makeImageSnapshot();
    const pixels = image.readPixels(0, 0, { width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!;
    const bytes = new Uint8Array(pixels);
    let painted = 0;
    for (let i = 3; i < bytes.length; i += 4) if (bytes[i] > 200) painted++;
    expect(painted).toBeGreaterThan(20000);
    if (process.env.BAKU_CAPTURE_DIR) {
      mkdirSync(process.env.BAKU_CAPTURE_DIR, { recursive: true });
      writeFileSync(resolve(process.env.BAKU_CAPTURE_DIR, `native-renderer-${time.toFixed(2)}.png`), image.encodeToBytes());
    }
    frames.push(bytes);
    [image, surface, paint, shader, vertices].forEach(r => r.dispose());
  }
  expect(frames[0]).not.toEqual(frames[2]);
  expect(deform(SNOUT.x, SNOUT.y, poseAt(.8, 0)).y).toBeLessThan(deform(SNOUT.x, SNOUT.y, poseAt(0, 0)).y);
  [...shaders, ...images, effect!].forEach(r => r.dispose());
});
