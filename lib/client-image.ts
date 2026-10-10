/** Browser-only: resize a picked/snapped photo to the stored long edge before upload. */

export const CLIENT_STORE_EDGE = 2000;

function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.hei[cf]$/i.test(file.name);
}

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  filename: string;
}

function outputName(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, "").trim() || "photo";
  return `${base}.jpg`;
}

export async function resizeImageFile(file: File, maxEdge = CLIENT_STORE_EDGE): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw the photo");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => {
          if (next) resolve(next);
          else reject(new Error("Could not encode the photo"));
        },
        "image/jpeg",
        0.88,
      );
    });
    return { blob, width, height, mime: "image/jpeg", filename: outputName(file.name) };
  } finally {
    bitmap.close();
  }
}

/**
 * Capture path: convert on the phone when the browser can decode the file.
 * Share-sheet HEIC that the canvas cannot read is uploaded as-is for server decode.
 */
export async function prepareUploadFile(file: File, maxEdge = CLIENT_STORE_EDGE): Promise<ResizedImage> {
  try {
    return await resizeImageFile(file, maxEdge);
  } catch {
    if (isHeicFile(file)) {
      return {
        blob: file,
        width: 0,
        height: 0,
        mime: file.type || "image/heic",
        filename: file.name,
      };
    }
    throw new Error("Could not read that photo");
  }
}
