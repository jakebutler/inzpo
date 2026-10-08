import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { CreateKitRequest, CreateKitResponse } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { isOwnedUploadKey, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { r2, GetObjectCommand, DeleteObjectCommand } from "@/lib/r2";
import { createImageItem } from "@/lib/items";
import { runBriefJob } from "@/lib/brief";
import { mobileError, readMobileJson } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const body = await readMobileJson(request);
  if (typeof body?.uploadKey !== "string" || (body.filename !== undefined && typeof body.filename !== "string")) {
    return mobileError("uploadKey and an optional filename are required", 400);
  }
  const input: CreateKitRequest = { uploadKey: body.uploadKey.trim(), filename: body.filename as string | undefined };
  // Mobile accepts only this owner's presigned upload, never a share-sheet stash.
  if (!isOwnedUploadKey(auth.ownerId, input.uploadKey)) return mobileError("Invalid upload key", 400);
  const client = r2();
  const bucket = process.env.R2_BUCKET!;
  let upload;
  try {
    upload = await client.send(new GetObjectCommand({ Bucket: bucket, Key: input.uploadKey }));
  } catch {
    return mobileError("Could not read upload", 400);
  }
  if ((upload.ContentLength ?? 0) > MAX_UPLOAD_BYTES) return mobileError("File is too large to upload", 400);
  let itemId: string;
  try {
    if (!upload.Body) return mobileError("Upload is empty", 400);
    const buffer = Buffer.from(await upload.Body.transformToByteArray());
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) return mobileError("Invalid image size", 400);
    itemId = await createImageItem({ ownerId: auth.ownerId, buffer, filename: input.filename?.trim() || "shared-image" });
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: input.uploadKey }));
    revalidatePath("/");
  } catch {
    return mobileError("Could not create kit from image", 400);
  }
  after(async () => { await runBriefJob(itemId); });
  return NextResponse.json<CreateKitResponse>({ itemId }, { status: 201 });
}
