import { rgbToHex } from "@/lib/colors";

/** Map a pointer on an object-fit: contain image to 0–1 source coordinates. */
export function pointerOnContainedImage(
  image: HTMLImageElement,
  clientX: number,
  clientY: number,
): { nx: number; ny: number } | null {
  const rect = image.getBoundingClientRect();
  const natW = image.naturalWidth || image.width;
  const natH = image.naturalHeight || image.height;
  if (natW <= 0 || natH <= 0 || rect.width <= 0 || rect.height <= 0) return null;
  const nat = natW / natH;
  const box = rect.width / rect.height;
  let contentW: number;
  let contentH: number;
  let offsetX: number;
  let offsetY: number;
  if (nat > box) {
    contentW = rect.width;
    contentH = rect.width / nat;
    offsetX = 0;
    offsetY = (rect.height - contentH) / 2;
  } else {
    contentH = rect.height;
    contentW = rect.height * nat;
    offsetY = 0;
    offsetX = (rect.width - contentW) / 2;
  }
  const x = clientX - rect.left - offsetX;
  const y = clientY - rect.top - offsetY;
  if (x < 0 || y < 0 || x > contentW || y > contentH) return null;
  return { nx: x / contentW, ny: y / contentH };
}

/** Area-averaged sample around a normalized pin on a displayed image. */
export function sampleImageAverage(
  image: HTMLImageElement,
  nx: number,
  ny: number,
  radius = 8,
): { hex: string; pinX: number; pinY: number } {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not sample the photo");
  ctx.drawImage(image, 0, 0);
  const w = canvas.width;
  const h = canvas.height;
  const cx = Math.max(0, Math.min(w - 1, Math.round(nx * w)));
  const cy = Math.max(0, Math.min(h - 1, Math.round(ny * h)));
  const left = Math.max(0, cx - radius);
  const top = Math.max(0, cy - radius);
  const size = radius * 2 + 1;
  const data = ctx.getImageData(left, top, Math.min(size, w - left), Math.min(size, h - top)).data;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  const rw = Math.min(size, w - left);
  const rh = Math.min(size, h - top);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const dx = left + x - cx;
      const dy = top + y - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = (y * rw + x) * 4;
      sr += data[i]!;
      sg += data[i + 1]!;
      sb += data[i + 2]!;
      n++;
    }
  }
  if (n === 0) {
    const px = ctx.getImageData(cx, cy, 1, 1).data;
    return { hex: rgbToHex(px[0]!, px[1]!, px[2]!), pinX: cx / w, pinY: cy / h };
  }
  return { hex: rgbToHex(sr / n, sg / n, sb / n), pinX: cx / w, pinY: cy / h };
}
