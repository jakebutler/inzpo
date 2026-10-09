import { mapCoverPinRaw, type CoverWindow } from "@/lib/cover-pin";

/**
 * A drop within this many CSS px of where the press began (or of the role's
 * existing pin) is a no-op: finger/mouse jitter must never rewrite a colour.
 * Anything farther is a real move and samples the exact source pixel.
 */
export const PIN_NOOP_TOLERANCE_PX = 4;

export type PointerPoint = { clientX: number; clientY: number };
export type PinDragPoint = { x: number; y: number; nx: number; ny: number };
export type PinDragGeometry = {
  width: number;
  height: number;
  boxWidth: number;
  boxHeight: number;
  crop: CoverWindow;
};

/** Cancels revert. A coordinate-less up uses the last real down/move position. */
export function resolvePinDropPoint(
  event: PointerPoint & { type: string },
  lastGood: PointerPoint | null,
): PointerPoint | null {
  if (event.type !== "pointerup") return null;
  const valid = Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
  // Some browsers use (0, 0) as a missing-position sentinel. A real move to
  // the viewport origin is still valid when it agrees with the last position.
  const missing = event.clientX === 0 && event.clientY === 0 &&
    lastGood !== null && (lastGood.clientX !== 0 || lastGood.clientY !== 0);
  if (valid && !missing) return { clientX: event.clientX, clientY: event.clientY };
  return lastGood && Number.isFinite(lastGood.clientX) && Number.isFinite(lastGood.clientY) ? lastGood : null;
}

export function isNoopPinDrag(
  start: PinDragPoint | null | undefined,
  end: PinDragPoint | null | undefined,
  imageSize: { width: number; height: number },
): boolean {
  if (!start || !end) return false;
  if (![start.x, start.y, start.nx, start.ny, end.x, end.y, end.nx, end.ny,
    imageSize.width, imageSize.height].every(Number.isFinite)) return false;
  if (imageSize.width <= 0 || imageSize.height <= 0) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) <= PIN_NOOP_TOLERANCE_PX;
}

/** Also preserve an existing pin when the press began elsewhere but returns to it. */
export function isNoopPinSample(
  existing: { pinX: number; pinY: number } | null | undefined,
  end: PinDragPoint,
  geometry: PinDragGeometry,
): boolean {
  if (!existing) return false;
  const mapped = mapCoverPinRaw(existing.pinX, existing.pinY, geometry.width, geometry.height,
    geometry.boxWidth, geometry.boxHeight, geometry.crop);
  return isNoopPinDrag(mapped ? {
    x: mapped.left * geometry.boxWidth,
    y: mapped.top * geometry.boxHeight,
    nx: existing.pinX,
    ny: existing.pinY,
  } : null, end, geometry);
}
