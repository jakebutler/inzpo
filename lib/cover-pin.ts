/** Visible window of an object-fit: cover box, in 0–1 source coordinates. */
export type CoverWindow = {
  vx: number;
  vy: number;
  vw: number;
  vh: number;
};

export const PIN_CROP_MARGIN_PX = 16;

/** Centered object-fit: cover window. */
export function coverWindow(imageW: number, imageH: number, boxW: number, boxH: number): CoverWindow | null {
  if (boxW <= 0 || boxH <= 0 || imageW <= 0 || imageH <= 0) return null;
  const imageAspect = imageW / imageH;
  const boxAspect = boxW / boxH;
  let vx = 0;
  let vy = 0;
  let vw = 1;
  let vh = 1;
  if (imageAspect > boxAspect) {
    vw = boxAspect / imageAspect;
    vx = (1 - vw) / 2;
  } else {
    vh = imageAspect / boxAspect;
    vy = (1 - vh) / 2;
  }
  return { vx, vy, vw, vh };
}

/**
 * Pan the cover crop so every pin sits inside with at least `marginPx` of box space.
 * Does not zoom out of cover (the frame stays filled).
 */
export function coverWindowForPins(
  imageW: number,
  imageH: number,
  boxW: number,
  boxH: number,
  pins: ReadonlyArray<{ x: number; y: number }>,
  marginPx = PIN_CROP_MARGIN_PX,
): CoverWindow | null {
  const base = coverWindow(imageW, imageH, boxW, boxH);
  if (!base) return null;
  if (pins.length === 0) return base;
  const mx = (marginPx / boxW) * base.vw;
  const my = (marginPx / boxH) * base.vh;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const pin of pins) {
    if (!Number.isFinite(pin.x) || !Number.isFinite(pin.y)) continue;
    minX = Math.min(minX, pin.x - mx);
    maxX = Math.max(maxX, pin.x + mx);
    minY = Math.min(minY, pin.y - my);
    maxY = Math.max(maxY, pin.y + my);
  }
  if (!Number.isFinite(minX)) return base;
  let { vx, vy, vw, vh } = base;
  if (maxX - minX <= vw) {
    const cx = (minX + maxX) / 2;
    vx = clamp(cx - vw / 2, 0, 1 - vw);
  } else {
    vx = clamp((minX + maxX) / 2 - vw / 2, 0, 1 - vw);
  }
  if (maxY - minY <= vh) {
    const cy = (minY + maxY) / 2;
    vy = clamp(cy - vh / 2, 0, 1 - vh);
  } else {
    vy = clamp((minY + maxY) / 2 - vh / 2, 0, 1 - vh);
  }
  return { vx, vy, vw, vh };
}

export function objectPositionCss(win: CoverWindow): string {
  const px = win.vw >= 1 - 1e-6 ? 50 : (win.vx / (1 - win.vw)) * 100;
  const py = win.vh >= 1 - 1e-6 ? 50 : (win.vy / (1 - win.vh)) * 100;
  return `${px}% ${py}%`;
}

/** Map a 0–1 source pin onto an object-fit: cover box. Null if the pin was cropped away. */
export function mapCoverPin(
  pinX: number,
  pinY: number,
  imageW: number,
  imageH: number,
  boxW: number,
  boxH: number,
  win?: CoverWindow | null,
): { left: number; top: number } | null {
  const window = win ?? coverWindow(imageW, imageH, boxW, boxH);
  if (!window) return null;
  if (!Number.isFinite(pinX) || !Number.isFinite(pinY)) return null;
  const { vx, vy, vw, vh } = window;
  if (pinX < vx || pinX > vx + vw || pinY < vy || pinY > vy + vh) return null;
  return {
    left: (pinX - vx) / vw,
    top: (pinY - vy) / vh,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
