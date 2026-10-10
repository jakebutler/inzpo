import type { Lab } from '@/lib/color-distance';

/** CIEDE2000 with the standard kL = kC = kH = 1 weights. Test-only metric. */
export function ciede2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const radians = Math.PI / 180;
  const sin = (degrees: number) => Math.sin(degrees * radians);
  const cos = (degrees: number) => Math.cos(degrees * radians);
  const cMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7))) / 2;
  const ap1 = (1 + g) * a1, ap2 = (1 + g) * a2;
  const c1 = Math.hypot(ap1, b1), c2 = Math.hypot(ap2, b2);
  const hue = (a: number, b: number) => (Math.atan2(b, a) / radians + 360) % 360;
  const h1 = c1 === 0 ? 0 : hue(ap1, b1), h2 = c2 === 0 ? 0 : hue(ap2, b2);
  let dh = h2 - h1;
  if (c1 * c2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dl = l2 - l1, dc = c2 - c1, dH = 2 * Math.sqrt(c1 * c2) * sin(dh / 2);
  const lm = (l1 + l2) / 2, cm = (c1 + c2) / 2;
  const hm = c1 * c2 === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2
    : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
  const t = 1 - 0.17 * cos(hm - 30) + 0.24 * cos(2 * hm) + 0.32 * cos(3 * hm + 6) - 0.20 * cos(4 * hm - 63);
  const sl = 1 + 0.015 * (lm - 50) ** 2 / Math.sqrt(20 + (lm - 50) ** 2);
  const sc = 1 + 0.045 * cm, sh = 1 + 0.015 * cm * t;
  const rt = -2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)) * sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)));
  return Math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh));
}
