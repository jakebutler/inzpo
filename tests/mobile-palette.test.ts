import { readFile } from 'node:fs/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import { COLOR_ROLES, colorHue, rolesFromColors } from '@inzpo/shared';
import type { ItemDetail } from '@/lib/items';
import { upgradeMobilePalette } from '@/lib/mobile-palette';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/lib/r2', async () => ({
  r2: () => ({ send: mocks.send }),
  GetObjectCommand: (await import('@aws-sdk/client-s3')).GetObjectCommand,
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

it('does not reinterpret manually edited or already current kits', async () => {
  const original = legacy('edited-house');
  const changed = { ...original, colors: original.colors.map((c) => c.role === 'primary' ? { ...c, pinX: null, pinY: null } : c) };
  expect(await upgradeMobilePalette(changed)).toBe(changed);
  const current = { ...original, colors: original.colors.map((c) => ({ ...c, origin: 'region' })) };
  expect(await upgradeMobilePalette(current)).toBe(current);
  expect(mocks.send).not.toHaveBeenCalled();
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
