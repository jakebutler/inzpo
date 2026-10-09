/** Reserve space for the form on short phones; 390pt-wide tall phones use 160pt. */
export function restingBakuSize(width: number, height: number): number {
  return Math.min(160, width * 160 / 390, Math.max(96, 96 + (height - 600) * 0.6));
}
