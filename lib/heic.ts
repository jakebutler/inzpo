import "server-only";
import sharp from "sharp";

/** ISO-BMFF major brands used by HEIC/HEIF (see heic-decode / file-type). */
const HEIC_BRANDS = new Set(["mif1", "msf1", "heic", "heix", "hevc", "hevx"]);

export function isHeicBuffer(input: Buffer): boolean {
  if (input.length < 12) return false;
  const box = input.subarray(4, 8).toString("ascii");
  if (box !== "ftyp") return false;
  const brand = input.subarray(8, 12).toString("ascii").replace(/\0/g, " ").trim();
  return HEIC_BRANDS.has(brand);
}

/**
 * Decode iPhone HEIC via libheif wasm. Prebuilt sharp on Vercel has no HEVC.
 * Returns an sRGB PNG buffer sharp can continue with.
 */
export async function decodeHeicToPng(input: Buffer): Promise<Buffer> {
  const decode = (await import("heic-decode")).default;
  const { width, height, data } = await decode({ buffer: input });
  if (!width || !height || !data) {
    throw new Error("HEIC decode returned an empty image");
  }
  return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}
