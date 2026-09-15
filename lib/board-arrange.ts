export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const GRID_GUTTER = 24;
const MIN_CELL = 24;

export function colsForCount(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  if (count <= 16) return 4;
  return Math.ceil(Math.sqrt(count));
}

function gridCells(count: number, canvas: { w: number; h: number }, startY: number): Rect[] {
  const cols = colsForCount(count);
  if (cols === 0) return [];
  const rows = Math.ceil(count / cols);
  const cellW = Math.max(MIN_CELL, Math.floor((canvas.w - (cols + 1) * GRID_GUTTER) / cols));
  const cellH = Math.max(MIN_CELL, Math.floor((canvas.h - (rows + 1) * GRID_GUTTER) / rows));
  const offsetX = Math.max(GRID_GUTTER, Math.floor((canvas.w - (cols * cellW + (cols + 1) * GRID_GUTTER)) / 2) + GRID_GUTTER);
  const out: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({
      x: offsetX + col * (cellW + GRID_GUTTER),
      y: startY + GRID_GUTTER + row * (cellH + GRID_GUTTER),
      w: cellW,
      h: cellH,
    });
  }
  return out;
}

/** Full re-pack: uniform cover-fit grid, centered, fixed gutter. Resets hand tweaks by design. */
export function packGridFull(count: number, canvas: { w: number; h: number }): Rect[] {
  return gridCells(count, canvas, 0);
}

/** Pack newly added items into a band below the current content, same grid rhythm. */
export function packGridBand(count: number, canvas: { w: number; h: number }, contentMaxY: number): Rect[] {
  return gridCells(count, canvas, Math.max(0, contentMaxY));
}

/** Lowest edge (plus gutter) of the given rects; 0 when empty. */
export function contentBottom(rects: Rect[], canvas: { w: number; h: number }): number {
  let max = 0;
  for (const r of rects) max = Math.max(max, r.y + r.h);
  return max === 0 ? 0 : Math.min(max + GRID_GUTTER, canvas.h);
}
