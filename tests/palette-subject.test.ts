import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { colorHue } from '@inzpo/shared';
import { hexToLab } from '@/lib/color-distance';
import { hexToFamily } from '@/lib/colors';
import { areaAverage, assignRoles, extractPalette, type PaletteSwatch } from '@/lib/palette-extract';
import { kitDisplayName } from '@/lib/kit-name';

function region(hex: string, patch: number, spatial?: PaletteSwatch['spatial']): PaletteSwatch {
  return { origin: 'region', hex, patch, share: patch, pinX: 0.5, pinY: 0.5,
    lab: hexToLab(hex), score: patch, family: hexToFamily(hex), name: hexToFamily(hex), role: null, spatial };
}
const skyGeometry = { touchesTop: true, borderEdges: 2, upperShare: 1, centralShare: 0, texture: 1 };

describe('subject palette', () => {
  it.each(['#426092', '#f2f4f7'])('never assigns sky %s to any automatic role', (hex) => {
    const sky = region(hex, 0.7, skyGeometry);
    const yellow = region('#d1cb9e', 0.2);
    const result = assignRoles([sky, yellow, region('#050404', 0.05)]);
    expect(result).not.toContain(sky);
    expect(sky.role).toBeNull();
    expect(result.find((s) => s.role === 'primary')).toBe(yellow);
    expect(result.find((s) => s.role === 'accent')).toBeUndefined();
  });

  it('follows adjacent sky around the roof, while a separate blue object remains eligible', () => {
    const sky = region('#426092', 0.5, skyGeometry);
    const roofSky = region('#4a689b', 0.1, { ...skyGeometry, touchesTop: false, borderEdges: 0 });
    const object = region('#235797', 0.03, { ...skyGeometry, touchesTop: false, upperShare: 0, centralShare: 1 });
    const neighbours = new Map([[sky, new Set([roofSky])], [roofSky, new Set([sky])]]);
    const result = assignRoles([sky, roofSky, object, region('#d1cb9e', 0.2), region('#050404', 0.05)], neighbours);
    expect(result).not.toContain(sky);
    expect(result).not.toContain(roofSky);
    expect(result.find((s) => s.role === 'accent')).toBe(object);
  });

  it('keeps sky available to explicit photo sampling', async () => {
    const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#426092' } }).png().toBuffer();
    expect((await areaAverage(image, 0.5, 0.05)).hex).toBe('#426092');
  });

  it.each(['jpeg', 'webp'] as const)('the actual yellow house reserves yellow and leaves Accent/Surface empty (%s)', async (format) => {
    const input = await readFile('public/sample/IMG_6505.jpg');
    const image = format === 'jpeg' ? input : await sharp(input).resize({ width: 640 }).webp({ quality: 82 }).toBuffer();
    const palette = await extractPalette(image);
    expect(colorHue(palette.roles.primary)).toBe('yellow');
    expect(palette.roles.primary).not.toBe(palette.roles.background);
    expect(palette.roles.accent).toBeNull();
    expect(palette.roles.surface).toBeNull();
    const primary = palette.swatches.find((s) => s.role === 'primary')!;
    expect(primary.pinX).toBeGreaterThan(0);
    expect(primary.pinY).toBeGreaterThan(0.2);
    // A region centroid can be on the window inside a connected wall. Every
    // actual pin must belong to its selected component, including Primary.
    for (const swatch of palette.swatches) {
      expect(palette.regionAtPin(swatch.pinX, swatch.pinY)).toBe(swatch);
    }
    // The old brief name and new caption both use this exact result's Primary.
    const title = kitDisplayName({ title: 'White Victorian', briefText: 'A white Victorian with a black door.',
      namedColors: [{ hex: '#ffffff', label: 'white trim' }], primary });
    expect(title).toBe('Yellow Victorian');
    expect(colorHue(primary.hex, primary.name)).toBe('yellow');
  });
});
