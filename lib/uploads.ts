import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { newId } from "@/lib/ids";

export const UPLOAD_PREFIX = "tmp/uploads/";
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function uploadExtForType(contentType: string): "png" | "webp" | "heic" | "jpg" {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic") || contentType.includes("heif")) return "heic";
  return "jpg";
}

export function validateUpload(input: { contentType: string; bytes: number }): void {
  if (!ALLOWED_UPLOAD_TYPES.has(input.contentType)) {
    throw new Error("Unsupported file type");
  }
  if (!Number.isFinite(input.bytes) || input.bytes <= 0 || input.bytes > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large to upload");
  }
}

export function isOwnedUploadKey(ownerId: string, key: string): boolean {
  const prefix = `${UPLOAD_PREFIX}${ownerId}/`;
  return key.startsWith(prefix) && !key.includes("..") && key.length < 200;
}

/** Share-sheet stash (`tmp/{id}.ext`) or a presigned per-owner upload. */
export function isReadableUploadKey(ownerId: string, key: string): boolean {
  if (isOwnedUploadKey(ownerId, key)) return true;
  return key.startsWith("tmp/") && !key.startsWith(UPLOAD_PREFIX) && !key.includes("..") && key.length < 200;
}

export async function presignUpload(input: {
  ownerId: string;
  contentType: string;
  bytes: number;
}): Promise<{ url: string; key: string; contentType: string }> {
  validateUpload(input);
  const ext = uploadExtForType(input.contentType);
  const key = `${UPLOAD_PREFIX}${input.ownerId}/${newId()}.${ext}`;
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: input.contentType,
    }),
    { expiresIn: 60 },
  );
  return { url, key, contentType: input.contentType };
}
