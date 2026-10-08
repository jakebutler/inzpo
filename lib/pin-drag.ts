/** Screen-space slack for a pin that was picked up and dropped on the same spot. */
export const PIN_NOOP_TOLERANCE_PX = 8;
/** Normalized-source slack, for when the pointer maps through a cover crop. */
export const PIN_NOOP_TOLERANCE_NORM = 0.01;

export type PinDragPoint = {
  x: number;
  y: number;
  nx?: number;
  ny?: number;
};

export function isNoopPinDrag(start: PinDragPoint | null | undefined, end: PinDragPoint | null | undefined): boolean {
  if (!start || !end) return false;
  if (![start.x, start.y, end.x, end.y].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return false;
  }
  const screen = Math.hypot(end.x - start.x, end.y - start.y);
  if (screen <= PIN_NOOP_TOLERANCE_PX) return true;
  if (
    typeof start.nx === "number" &&
    typeof start.ny === "number" &&
    typeof end.nx === "number" &&
    typeof end.ny === "number" &&
    Number.isFinite(start.nx) &&
    Number.isFinite(start.ny) &&
    Number.isFinite(end.nx) &&
    Number.isFinite(end.ny)
  ) {
    return Math.hypot(end.nx - start.nx, end.ny - start.ny) <= PIN_NOOP_TOLERANCE_NORM;
  }
  return false;
}

/** True when the drop lands on the role's existing pin, so save must not rewrite the color. */
export function isNoopPinSample(
  existing: { pinX: number; pinY: number } | null | undefined,
  nextNx: number,
  nextNy: number,
): boolean {
  if (!existing) return false;
  if (![existing.pinX, existing.pinY, nextNx, nextNy].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return false;
  }
  return Math.hypot(nextNx - existing.pinX, nextNy - existing.pinY) <= PIN_NOOP_TOLERANCE_NORM;
}
