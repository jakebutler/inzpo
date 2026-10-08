import { PHOTO_BACK_LEFT_PX, PHOTO_BACK_TOP_PX, PHOTO_BACK_PX, PIN_SIZE, PIN_OUTER_RING_PX } from "@/lib/brand";
import type { Hairline } from "@/lib/hairlines";

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

export const PIN_EDGE_MARGIN_PX = 11;
export const PIN_HIT_SIZE_PX = 32;
export const PIN_MIN_SPACING_PX = 44;
export const PIN_BACK_ZONE_PX = 52;
export const PIN_DISC_RADIUS_PX = PIN_SIZE / 2 + PIN_OUTER_RING_PX;

export type PinExclusion = { left: number; top: number; right: number; bottom: number };

/** The photo Back box, expanded to 52px about its center, including safe-area top. */
export function photoBackZone(safeTopPx = 0): PinExclusion {
  const expansion = (PIN_BACK_ZONE_PX - PHOTO_BACK_PX) / 2;
  const left = PHOTO_BACK_LEFT_PX - expansion;
  const top = PHOTO_BACK_TOP_PX + Math.max(0, safeTopPx) - expansion;
  return { left, top, right: left + PIN_BACK_ZONE_PX, bottom: top + PIN_BACK_ZONE_PX };
}

function insideZone(x: number, y: number, zone: PinExclusion): boolean {
  return x > zone.left && x < zone.right && y > zone.top && y < zone.bottom;
}

export function pinPlacement(x: number, y: number, boxW: number, boxH: number, avoid?: PinExclusion | null) {
  const disc = clampPinCenter(x, y, boxW, boxH, avoid);
  return placementFromDisc(x, y, disc, boxW, boxH);
}

function placementFromDisc(x: number, y: number, disc: { x: number; y: number }, boxW: number, boxH: number) {
  const displaced = disc.x !== x || disc.y !== y;
  const offcrop = x < 0 || x > boxW || y < 0 || y > boxH;
  // Stop off-crop ticks at the photo boundary along the ray to the TRUE point.
  // The inset leaves at least 11px exposed beyond the disc's ink ring.
  const dx = x - disc.x;
  const dy = y - disc.y;
  const t = offcrop ? Math.min(1,
    dx < 0 ? -disc.x / dx : dx > 0 ? (boxW - disc.x) / dx : Infinity,
    dy < 0 ? -disc.y / dy : dy > 0 ? (boxH - disc.y) / dy : Infinity,
  ) : 1;
  return {
    disc,
    hit: disc,
    displaced,
    offcrop,
    tick: displaced ? {
      x1: disc.x, y1: disc.y,
      x2: offcrop ? disc.x + dx * t : x,
      y2: offcrop ? disc.y + dy * t : y,
    } satisfies Hairline : null,
  };
}

/**
 * Lay out photo-pixel points in a stable order (callers use role order). True
 * non-zone points are anchors, even when close together. Only displaced discs
 * slide, along their original inset edge or Back boundary, without moving samples.
 */
export function layoutPins(
  pins: ReadonlyArray<{ x: number; y: number }>,
  box: { w: number; h: number },
  avoid?: PinExclusion | null,
) {
  const placements = pins.map(({ x, y }) => pinPlacement(x, y, box.w, box.h, avoid));
  if (!Number.isFinite(box.w) || !Number.isFinite(box.h) || box.w <= 0 || box.h <= 0) return placements;
  const obstacles = placements.filter(p => !p.displaced).map(p => p.disc);
  const inset = PIN_EDGE_MARGIN_PX + PIN_DISC_RADIUS_PX;
  const minX = Math.min(inset, box.w / 2);
  const maxX = box.w - minX;
  const minY = Math.min(inset, box.h / 2);
  const maxY = box.h - minY;
  const zone = avoid ? {
    left: avoid.left - PIN_DISC_RADIUS_PX, right: avoid.right + PIN_DISC_RADIUS_PX,
    top: avoid.top - PIN_DISC_RADIUS_PX, bottom: avoid.bottom + PIN_DISC_RADIUS_PX,
  } : null;
  return placements.map((placement, i) => {
    if (!placement.displaced) return placement;
    const { disc } = placement;
    const pin = pins[i]!;
    // At an edge corner, prefer the vertical edge. A Back-only projection must
    // stay on its chosen zone side even when it happens to meet the photo inset.
    const edgeVertical = (pin.x < PIN_EDGE_MARGIN_PX || pin.x > box.w - PIN_EDGE_MARGIN_PX) &&
      (disc.x === minX || disc.x === maxX);
    const edgeHorizontal = (pin.y < PIN_EDGE_MARGIN_PX || pin.y > box.h - PIN_EDGE_MARGIN_PX) &&
      (disc.y === minY || disc.y === maxY);
    const vertical = edgeVertical || !edgeHorizontal && !!zone && (disc.x === zone.left || disc.x === zone.right);
    const fixed = vertical ? disc.x : disc.y;
    const original = vertical ? disc.y : disc.x;
    const lo = vertical ? minY : minX;
    const hi = vertical ? maxY : maxX;
    const pointAt = (t: number) => vertical ? { x: fixed, y: t } : { x: t, y: fixed };
    const candidates = [lo, hi, clamp(original, lo, hi)];
    if (zone) candidates.push(vertical ? zone.top : zone.left, vertical ? zone.bottom : zone.right);
    const projected = obstacles.map(p => ({ along: vertical ? p.y : p.x, across: (vertical ? p.x : p.y) - fixed }));
    for (const p of projected) {
      // CSS layout rounds subpixels (Chromium uses 1/64px). Leave enough room
      // that rendered centers, as well as these coordinates, clear 44px.
      const reach = Math.sqrt(Math.max(0, (PIN_MIN_SPACING_PX + 1 / 32) ** 2 - p.across ** 2));
      candidates.push(p.along - reach, p.along + reach);
    }
    // If the whole edge is crowded, the maximum of its minimum separation lies
    // at an endpoint or where two obstacles are equally far away.
    for (let a = 0; a < projected.length; a++) {
      for (let b = a + 1; b < projected.length; b++) {
        const p = projected[a]!;
        const q = projected[b]!;
        if (p.along !== q.along) candidates.push(
          (q.along ** 2 + q.across ** 2 - p.along ** 2 - p.across ** 2) / (2 * (q.along - p.along)),
        );
      }
    }
    const spots = candidates.filter(t => t >= lo && t <= hi).map(t => {
      const point = pointAt(t);
      return {
        point, t, travel: Math.abs(t - original),
        separation: Math.min(...obstacles.map(p => Math.hypot(point.x - p.x, point.y - p.y))),
      };
    }).filter(({ point }) => !zone || !insideZone(point.x, point.y, zone));
    const nearest = (a: typeof spots[number], b: typeof spots[number]) => a.travel - b.travel || a.t - b.t;
    const valid = spots.filter(p => p.separation >= PIN_MIN_SPACING_PX).sort(nearest);
    const best = valid[0] ?? spots.sort((a, b) => b.separation - a.separation || nearest(a, b))[0];
    const finalDisc = best?.point ?? disc;
    obstacles.push(finalDisc);
    return placementFromDisc(pin.x, pin.y, finalDisc, box.w, box.h);
  });
}

/** Place every stored sample visibly, without changing its source coordinates. */
export function coverPinPlacement(
  pinX: number,
  pinY: number,
  imageW: number,
  imageH: number,
  boxW: number,
  boxH: number,
  win?: CoverWindow | null,
  avoid?: PinExclusion | null,
) {
  const mapped = mapCoverPinRaw(pinX, pinY, imageW, imageH, boxW, boxH, win);
  return mapped ? pinPlacement(mapped.left * boxW, mapped.top * boxH, boxW, boxH, avoid) : null;
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
  const mapped = mapCoverPinRaw(pinX, pinY, imageW, imageH, boxW, boxH, win);
  if (!mapped) return null;
  if (mapped.left < 0 || mapped.left > 1 || mapped.top < 0 || mapped.top > 1) return null;
  return mapped;
}

/** Same mapping as mapCoverPin, but coordinates may fall outside 0–1 when the sample is cropped. */
export function mapCoverPinRaw(
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
  if (vw <= 0 || vh <= 0) return null;
  return {
    left: (pinX - vx) / vw,
    top: (pinY - vy) / vh,
  };
}

/**
 * Only zone samples move. Project to the nearest legal disc center: its ink ring
 * clears Back's 52px zone and fits wholly inside the photo's 11px edge inset.
 * Source coordinates are never clamped; hit and disc use this same center.
 */
export function clampPinCenter(
  leftPx: number,
  topPx: number,
  boxW: number,
  boxH: number,
  avoid?: PinExclusion | null,
): { x: number; y: number } {
  if (!Number.isFinite(boxW) || !Number.isFinite(boxH) || boxW <= 0 || boxH <= 0) {
    return { x: leftPx, y: topPx };
  }
  const inEdgeZone = leftPx < PIN_EDGE_MARGIN_PX || leftPx > boxW - PIN_EDGE_MARGIN_PX ||
    topPx < PIN_EDGE_MARGIN_PX || topPx > boxH - PIN_EDGE_MARGIN_PX;
  if (!inEdgeZone && !(avoid && insideZone(leftPx, topPx, avoid))) return { x: leftPx, y: topPx };
  const inset = PIN_EDGE_MARGIN_PX + PIN_DISC_RADIUS_PX;
  const minX = Math.min(inset, boxW / 2);
  const maxX = boxW - minX;
  const minY = Math.min(inset, boxH / 2);
  const maxY = boxH - minY;
  const center = {
    x: clamp(leftPx, minX, maxX),
    y: clamp(topPx, minY, maxY),
  };
  // The illegal centers form the zone expanded by the disc's radius. Project
  // onto each available side, then choose by distance from the TRUE point.
  const radius = PIN_DISC_RADIUS_PX;
  if (avoid && insideZone(center.x, center.y, {
    left: avoid.left - radius, top: avoid.top - radius,
    right: avoid.right + radius, bottom: avoid.bottom + radius,
  })) {
    const candidates = [
      { x: avoid.left - radius, y: center.y },
      { x: avoid.right + radius, y: center.y },
      { x: center.x, y: avoid.top - radius },
      { x: center.x, y: avoid.bottom + radius },
    ].filter(({ x, y }) => x >= minX && x <= maxX && y >= minY && y <= maxY);
    candidates.sort((a, b) => Math.hypot(a.x - leftPx, a.y - topPx) - Math.hypot(b.x - leftPx, b.y - topPx));
    return candidates[0] ?? center;
  }
  return center;
}

/** Map a pointer on an object-fit: cover box to 0–1 source coordinates. */
export function pointerOnCoverBox(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
  win: CoverWindow,
): { nx: number; ny: number; x: number; y: number } | null {
  if (![clientX, clientY, box.left, box.top, box.width, box.height, win.vx, win.vy, win.vw, win.vh]
    .every(Number.isFinite)) return null;
  if (box.width <= 0 || box.height <= 0 || win.vw <= 0 || win.vh <= 0) return null;
  const x = clientX - box.left;
  const y = clientY - box.top;
  if (x < 0 || y < 0 || x > box.width || y > box.height) return null;
  return {
    x,
    y,
    nx: win.vx + (x / box.width) * win.vw,
    ny: win.vy + (y / box.height) * win.vh,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
