import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AlphaType, BlendMode, ColorType, FilterMode, MipmapMode, Skia, TileMode, VertexMode } from '@shopify/react-native-skia';
import { KNIT_SHADER } from './shader';
import { chipFlight, inhaleRibbon } from './transport';
import { resultLayout } from '../lib/result-layout';
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
  const photo = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(readFileSync(resolve(__dirname, '../../../../public/sample/IMG_6505.jpg'))))!;
  for (const time of [0, .50, .65, .8, 2, 3.1, 3.24, 3.35, 3.55, 3.85, durationFor(0)]) {
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
      // Composition geometry evidence only: real shader + runtime transport and
      // layout functions. Stock rectangles stand in for RN PaintChip controls;
      // this is deliberately not presented as an iPhone screenshot.
      const layout = resultLayout({ width: 390, height: 844, topInset: 47, bottomInset: 34 });
      const plate = Skia.Surface.Make(780, Math.ceil(layout.heroHeight * 2))!;
      const canvas = plate.getCanvas(); canvas.scale(2, 2);
      canvas.clear(Skia.Color('#f4efdf'));
      const brush = Skia.Paint(); brush.setAntiAlias(true);
      const printX = (390 - layout.printWidth) / 2;
      brush.setColor(Skia.Color('#fffdf4'));
      canvas.drawRect(Skia.XYWHRect(printX, 0, layout.printWidth, layout.printHeight), brush);
      const photoW = layout.printWidth - 26, photoH = layout.photoHeight;
      const scale = Math.max(photoW / photo.width(), photoH / photo.height());
      const cropX = (photo.width() - photoW / scale) / 2;
      canvas.drawImageRect(photo, Skia.XYWHRect(cropX, 0, photoW / scale, photoH / scale),
        Skia.XYWHRect(printX + 13, 13, photoW, photoH), brush);
      const baku = { x: 118, y: layout.printHeight - 100, width: 280 };
      canvas.drawImageRect(image, Skia.XYWHRect(0, 0, width, height),
        Skia.XYWHRect(baku.x, baku.y, baku.width, baku.width * 2 / 3), brush);
      const colors = ['#d6d3af', '#615343', null, '#eee9d9', null, '#202421'];
      layout.slots.map((slot, index) => ({ slot, index })).sort((a, b) => a.slot.zIndex - b.slot.zIndex).forEach(({ slot, index }) => {
        const target = { x: slot.x + 20 + slot.width / 2, y: slot.y + layout.printHeight - 113 + slot.height / 2 };
        const flight = chipFlight(time, 0, baku, target, index);
        const color = colors[index];
        canvas.save();
        canvas.translate(color ? flight.x : target.x, color ? flight.y : target.y);
        canvas.rotate(slot.rotation + (color ? flight.rotation : 0), 0, 0);
        canvas.scale(color ? flight.scale : 1, color ? flight.scale : 1);
        brush.setColor(Skia.Color('#fffdf4')); brush.setAlphaf(color ? flight.opacity : flight.blankOpacity);
        canvas.drawRect(Skia.XYWHRect(-slot.width / 2, -slot.height / 2, slot.width, slot.height), brush);
        if (color) {
          brush.setColor(Skia.Color(color)); brush.setAlphaf(flight.opacity);
          canvas.drawRect(Skia.XYWHRect(-slot.width / 2 + 1, -slot.height / 2 + 1, slot.width - 2, slot.height * .7), brush);
        }
        canvas.restore();
      });
      // Fixed fixture positions exercise curved stream geometry; production
      // receives measured photoPins, never these illustrative positions.
      const sources = [{ x: printX + 70, y: 175 }, { x: printX + 105, y: 220 },
        { x: printX + 160, y: 140 }, { x: printX + 80, y: 270 }];
      sources.forEach((source, index) => {
        const ribbon = inhaleRibbon(time, 0, source, baku, index);
        if (!ribbon.points.length) return;
        const builder = Skia.PathBuilder.Make(); builder.moveTo(ribbon.points[0].x, ribbon.points[0].y);
        ribbon.points.slice(1).forEach(point => builder.lineTo(point.x, point.y)); builder.close();
        const path = builder.detach();
        brush.setColor(Skia.Color(colors.filter(Boolean)[index]!)); brush.setAlphaf(ribbon.opacity);
        canvas.drawPath(path, brush); path.dispose();
      });
      plate.flush(); const geometryImage = plate.makeImageSnapshot();
      writeFileSync(resolve(process.env.BAKU_CAPTURE_DIR, `transport-geometry-${time.toFixed(2)}.png`), geometryImage.encodeToBytes());
      [geometryImage, plate, brush].forEach(resource => resource.dispose());
    }
    frames.push(bytes);
    [image, surface, paint, shader, vertices].forEach(r => r.dispose());
  }
  expect(frames[0]).not.toEqual(frames[2]);
  expect(deform(SNOUT.x, SNOUT.y, poseAt(.8, 0)).y).toBeLessThan(deform(SNOUT.x, SNOUT.y, poseAt(0, 0)).y);
  [...shaders, ...images, photo, effect!].forEach(r => r.dispose());
});
