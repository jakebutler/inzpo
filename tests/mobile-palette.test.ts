import { readFile } from 'node:fs/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import { COLOR_ROLES, colorHue, rolesFromColors } from '@inzpo/shared';
import type { ItemDetail } from '@/lib/items';
import { upgradeMobilePalette } from '@/lib/mobile-palette';
import sharp from 'sharp';
import { extractPalette } from '@/lib/palette-extract';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/lib/r2', async () => ({
  r2: () => ({ send: mocks.send }),
  GetObjectCommand: (await import('@aws-sdk/client-s3')).GetObjectCommand,
  variantKey: (id: string, variant: string) => `items/${id}/${variant}.webp`,
}));

function legacy(key: string): ItemDetail {
  return { id: key, kind: 'photo', title: 'White Victorian', note: null, source: null, origin: null,
    oembedHtml: null, hasArticle: false, createdAt: new Date(0),
    media: { originalKey: key, displayKey: null, width: 1500, height: 2000, mime: 'image/jpeg', tileKey: null, placeholder: null },
    colors: COLOR_ROLES.map((role, position) => ({ hex: role === 'primary' ? '#60615e' : '#d1cb9e',
      role, name: 'gray', family: 'gray', origin: 'extracted', position, pinX: 0.3, pinY: 0.4 })) };
}
beforeEach(() => vi.clearAllMocks());

it('reopening a legacy house refreshes its automatic roles and caches the photo, without writing user data', async () => {
  const input = await readFile('public/sample/IMG_6505.jpg');
  mocks.send.mockResolvedValue({ Body: { transformToByteArray: async () => input } });
  const original = legacy('legacy-house');
  const kit = await upgradeMobilePalette(original);
  const roles = rolesFromColors(kit.colors);
  expect(colorHue(roles.primary)).toBe('yellow');
  expect(roles.accent).toBeNull();
  expect(roles.surface).toBeNull();
  expect(original.colors[0].hex).toBe('#60615e');
  await upgradeMobilePalette(original);
  expect(mocks.send).toHaveBeenCalledTimes(1);
  // Explicit sky pin is retained even when the cached auto result has no accent.
  const sampled = { ...original.colors[2], hex: '#426092', name: 'sky blue', origin: 'sampled', pinX: 0.08, pinY: 0.04 };
  const edited = await upgradeMobilePalette({ ...original, colors: original.colors.map((c) => c.role === 'accent' ? sampled : c) });
  expect(edited.colors.find((c) => c.role === 'accent')).toEqual(sampled);
  expect(rolesFromColors((await upgradeMobilePalette(original)).colors).accent).toBeNull();
});

it('does not reinterpret manual hex edits or sampled colors', async () => {
  const original = legacy('edited-house');
  const changed = { ...original, colors: original.colors.map((c) => c.role === 'primary' ? { ...c, pinX: null, pinY: null } : c) };
  expect(await upgradeMobilePalette(changed)).toBe(changed);
  const current = { ...original, colors: original.colors.map((c) => ({ ...c, origin: 'sampled' })) };
  expect(await upgradeMobilePalette(current)).toBe(current);
  expect(mocks.send).not.toHaveBeenCalled();
});

it('reanchors stored region pins without filling cleared roles or changing explicit samples', async () => {
  const input = await readFile('public/sample/IMG_6505.jpg');
  const palette = await extractPalette(input);
  mocks.send.mockResolvedValue({ Body: { transformToByteArray: async () => input } });
  const original = legacy('region-house');
  original.colors = palette.swatches.filter((s) => s.role !== 'secondary').map((s, position) => ({
    hex: s.hex, role: s.role, name: s.name, family: s.family, origin: s.origin, position, pinX: 0.4, pinY: 0.3,
  }));
  const sampled = { ...original.colors[0], role: 'accent' as const, hex: '#426092', origin: 'sampled', pinX: 0.08, pinY: 0.04 };
  original.colors.push(sampled);
  const updated = await upgradeMobilePalette(original);
  expect(updated.colors.find((c) => c.role === 'accent')).toEqual(sampled);
  expect(updated.colors.find((c) => c.role === 'secondary')).toBeUndefined();
  const primary = updated.colors.find((c) => c.role === 'primary')!;
  expect(palette.regionAtPin(primary.pinX!, primary.pinY!)?.role).toBe('primary');
  expect(primary.hex).toBe(rolesFromColors(original.colors).primary);
});

it('a failed photo refresh can retry rather than caching a rejection', async () => {
  const original = legacy('retry-house');
  mocks.send.mockRejectedValueOnce(new Error('offline'));
  await expect(upgradeMobilePalette(original)).rejects.toThrow('offline');
  const input = await readFile('public/sample/IMG_6505.jpg');
  mocks.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => input } });
  expect(colorHue(rolesFromColors((await upgradeMobilePalette(original)).colors).primary)).toBe('yellow');
  expect(mocks.send).toHaveBeenCalledTimes(2);
});


it('reanchors capture hexes using w640 rather than missing the match on the original JPEG', async () => {
  const input = await readFile('public/sample/IMG_6505.jpg');
  const variant = await sharp(input).resize({ width: 640 }).webp({ quality: 82 }).toBuffer();
  const captured = await extractPalette(variant);
  const originalPalette = await extractPalette(input);
  const capturedPrimary = captured.swatches.find((swatch) => swatch.role === 'primary')!;
  expect(capturedPrimary.hex).not.toBe(originalPalette.roles.primary);
  const item = legacy('compressed-region-house');
  item.colors = captured.swatches.map((swatch, position) => ({ hex: swatch.hex, role: swatch.role,
    name: swatch.name, family: swatch.family, origin: swatch.origin, position,
    // Simulate the pre-fix region centroid in a window.
    pinX: 0.5, pinY: 0.3 }));
  mocks.send.mockImplementation(async (command) => ({ Body: { transformToByteArray: async () =>
    command.input.Key === 'items/compressed-region-house/w640.webp' ? variant : input } }));
  const updated = await upgradeMobilePalette(item);
  const primary = updated.colors.find((color) => color.role === 'primary')!;
  expect(primary.hex).toBe(capturedPrimary.hex);
  expect(primary.pinX).toBe(capturedPrimary.pinX);
  expect(primary.pinY).toBe(capturedPrimary.pinY);
  expect(captured.regionAtPin(primary.pinX!, primary.pinY!)?.role).toBe('primary');
  expect(mocks.send.mock.calls[0][0].input.Key).toBe('items/compressed-region-house/w640.webp');
});
