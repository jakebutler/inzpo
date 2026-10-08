/** Map a 0–1 source pin onto an object-fit: cover box. Null if the pin was cropped away. */
export function mapCoverPin(
  pinX: number,
  pinY: number,
  imageW: number,
  imageH: number,
  boxW: number,
  boxH: number,
): { left: number; top: number } | null {
  if (boxW <= 0 || boxH <= 0 || imageW <= 0 || imageH <= 0) return null;
  if (!Number.isFinite(pinX) || !Number.isFinite(pinY)) return null;
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
  if (pinX < vx || pinX > vx + vw || pinY < vy || pinY > vy + vh) return null;
  return {
    left: (pinX - vx) / vw,
    top: (pinY - vy) / vh,
  };
}
