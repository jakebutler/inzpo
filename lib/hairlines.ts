export type Hairline = { x1: number; y1: number; x2: number; y2: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function nearestOnRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): { x: number; y: number } {
  return { x: clamp(x, left, right), y: clamp(y, top, bottom) };
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
}

function onSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return (
    Math.min(ax, bx) - 0.5 <= cx &&
    cx <= Math.max(ax, bx) + 0.5 &&
    Math.min(ay, by) - 0.5 <= cy &&
    cy <= Math.max(ay, by) + 0.5
  );
}

/** True when two open segments cross (shared endpoints do not count). */
export function segmentsCross(a: Hairline, b: Hairline): boolean {
  const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  if (o1 === 0 && onSegment(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)) return false;
  if (o2 === 0 && onSegment(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)) return false;
  if (o3 === 0 && onSegment(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)) return false;
  if (o4 === 0 && onSegment(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)) return false;
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export type BandBox = { left: number; top: number; right: number; bottom: number; visible: boolean };

/** A visible band's disc (including a displaced disc) leads to the photo bottom, never into a band. */
export function preferredHairline(
  sampleX: number | null,
  sampleY: number | null,
  band: BandBox,
  photoBottom: number,
): Hairline | null {
  if (!band.visible || sampleX == null || sampleY == null) return null;
  return {
    x1: sampleX,
    y1: clamp(sampleY, 0, photoBottom),
    x2: sampleX,
    y2: photoBottom,
  };
}

/** Prefer 16px inset / band-center ends; if a pair crosses, land on the band's nearest point. */
export function uncrossHairlines(
  lines: Array<Hairline | null>,
  nearest: Array<{ x: number; y: number } | null>,
): Array<Hairline | null> {
  const out = lines.map((line) => (line ? { ...line } : null));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i];
      const b = out[j];
      if (!a || !b) continue;
      if (!segmentsCross(a, b)) continue;
      const na = nearest[i];
      const nb = nearest[j];
      if (na) {
        a.x2 = na.x;
        a.y2 = na.y;
      }
      if (nb) {
        b.x2 = nb.x;
        b.y2 = nb.y;
      }
      if (!segmentsCross(a, b)) continue;
      if ((a.y1 - b.y1) * (a.y2 - b.y2) < 0) {
        const ay = a.y2;
        a.y2 = b.y2;
        b.y2 = ay;
      }
    }
  }
  return out;
}
