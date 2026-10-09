import { COLOR_ROLES, type ColorRole } from '@inzpo/shared';

export type ChipSlot = {
  role: ColorRole; x: number; y: number; width: number; height: number; rotation: number; zIndex: number;
};
// Final Round 5b CSS, measured at 390x844. Keep these seeds stable on refresh.
const seeds = [
  [0, 0, 132, 196, -2, 12], [133, 65, 118, 152, 1.2, 10],
  [238, 22, 112, 160, -0.6, 11], [8, 181, 118, 154, 1.7, 8],
  [120, 205, 120, 168, -1.3, 9], [237, 226, 113, 130, 2, 11],
] as const;

export function rotatedBounds(slot: ChipSlot) {
  const radians = Math.abs(slot.rotation) * Math.PI / 180;
  const width = slot.width * Math.cos(radians) + slot.height * Math.sin(radians);
  const height = slot.height * Math.cos(radians) + slot.width * Math.sin(radians);
  return { left: slot.x + (slot.width - width) / 2, right: slot.x + (slot.width + width) / 2,
    top: slot.y + (slot.height - height) / 2, bottom: slot.y + (slot.height + height) / 2 };
}

export function resultLayout({ width, height, topInset = 0, bottomInset = 0, fontScale = 1, actionHeight = 48, measuredHeaderHeight }: {
  width: number; height: number; topInset?: number; bottomInset?: number; fontScale?: number; actionHeight?: number; measuredHeaderHeight?: number;
}) {
  const contentWidth = Math.min(350, width - 40);
  const horizontalScale = contentWidth / 350;
  const headerHeight = measuredHeaderHeight ?? 86 + 32 * Math.max(0, fontScale - 1);
  const printTop = Math.max(20, topInset) + headerHeight;
  const printHeight = Math.min(380, Math.round(height * 0.45));
  const photoHeight = printHeight - 50;
  const printWidth = Math.min(274 * horizontalScale, photoHeight * (248 / 330) + 26);
  const footerBottom = Math.max(24, bottomInset + 16);
  const footerTop = height - footerBottom - Math.max(48, actionHeight);
  // Leave 20pt between the rotated stock and the action face. On smaller
  // phones only paint/spacing compress; label type never drops below 11pt.
  const pileTop = printTop + printHeight - 113;
  const available = footerTop - 20 - pileTop;
  const verticalScale = Math.max(0.6, Math.min(1, available / 376));
  const typeSize = Math.max(11, (44 / 3) * verticalScale);
  const slots = COLOR_ROLES.map((role, index): ChipSlot => {
    const [x, y, w, h, rotation, zIndex] = seeds[index];
    // Dynamic Type expands each row downward instead of clipping a label.
    const extra = Math.max(0, fontScale - 1) * 92;
    return { role, x: x * horizontalScale, y: y * verticalScale + (index > 2 ? extra : 0),
      width: w * horizontalScale, height: h * verticalScale + extra, rotation, zIndex };
  });
  if (fontScale > 1.25) {
    // At accessibility sizes use one staggered column. Earlier cards cover
    // only the next card's paint, so wrapping cannot obscure another label.
    let y = 0;
    slots.forEach((slot, index) => {
      slot.width = contentWidth * (index === 0 ? 1 : 0.92);
      slot.x = index === 0 ? 0 : index % 2 ? contentWidth * 0.08 : 0;
      slot.y = y;
      slot.zIndex = 12 - index;
      y += slot.height - 16;
    });
  }
  const pileHeight = Math.max(...slots.map((slot) => rotatedBounds(slot).bottom)) + 3;
  const heroHeight = printHeight - 113 + pileHeight;
  return { contentWidth, horizontalScale, printTop, printWidth, printHeight, photoHeight,
    pileTop, pileHeight, heroHeight, footerTop, footerBottom, typeSize, slots };
}
