import { resultLayout, rotatedBounds } from './result-layout';

test.each([
  { width: 390, height: 844 }, { width: 390, height: 844, topInset: 47, bottomInset: 34 },
  { width: 375, height: 667, topInset: 20 }, { width: 375, height: 667, topInset: 24, bottomInset: 16 },
])('six landed cards fit above pinned actions at $width x $height (insets: $topInset/$bottomInset)', (screen) => {
  const layout = resultLayout(screen);
  expect(layout.printHeight / screen.height).toBeCloseTo(0.45, 2);
  expect(layout.typeSize).toBeGreaterThanOrEqual(11);
  expect(layout.slots).toHaveLength(6);
  for (const slot of layout.slots) {
    expect(Math.abs(slot.rotation)).toBeLessThanOrEqual(2);
    expect(slot.width).toBeGreaterThanOrEqual(44);
    expect(slot.height).toBeGreaterThanOrEqual(44);
    expect(layout.pileTop + rotatedBounds(slot).bottom).toBeLessThan(layout.footerTop - 12);
  }
  const primary = layout.slots[0];
  for (const other of layout.slots.slice(1)) {
    expect(primary.zIndex).toBeGreaterThan(other.zIndex);
    expect(primary.width * primary.height).toBeGreaterThan(other.width * other.height);
    expect(primary.y).toBeLessThan(other.y);
  }
});

test('390x844 retains the measured Round 5b pile and upright 274x380 film', () => {
  const layout = resultLayout({ width: 390, height: 844 });
  expect(layout.printWidth).toBe(274);
  expect(layout.printHeight).toBe(380);
  expect(layout.slots[0]).toMatchObject({ x: 0, y: 0, width: 132, height: 196, rotation: -2 });
  expect(layout.slots[1]).toMatchObject({ x: 133, y: 65, rotation: 1.2 });
  expect(layout.pileTop).toBe(layout.printTop + layout.printHeight - 113);
});

test('large text expands the scrollable pile rather than shrinking or clamping type', () => {
  const normal = resultLayout({ width: 375, height: 667 });
  const large = resultLayout({ width: 375, height: 667, fontScale: 2 });
  expect(large.slots[4].height).toBeGreaterThan(normal.slots[4].height);
  expect(large.slots[4].y).toBeGreaterThan(normal.slots[4].y);
  expect(large.heroHeight).toBeGreaterThan(normal.heroHeight);
  expect(large.typeSize).toBeGreaterThanOrEqual(11);
});
