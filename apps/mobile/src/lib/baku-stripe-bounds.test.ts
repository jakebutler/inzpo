import { bakuTintAssets } from './baku-assets';
import { bakuStripeBounds } from './baku-stripe-bounds';

test('every pose has six bounds entries matching the asset table', () => {
  expect(Object.keys(bakuStripeBounds)).toEqual(Object.keys(bakuTintAssets));
  Object.values(bakuStripeBounds).forEach((bounds) => {
    expect(bounds).toHaveLength(6);
    bounds.forEach((extent) => {
      if (!extent) return;
      const [top, bottom] = extent;
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThan(bottom);
      expect(bottom).toBeLessThanOrEqual(1);
    });
  });
});

test('poses with empty stripe masks have null extents', () => {
  expect(bakuStripeBounds.empty).toEqual(Array(6).fill(null));
  expect(bakuStripeBounds.errorPhoto).toEqual(Array(6).fill(null));
});
