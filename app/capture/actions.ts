"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createImageItem } from "@/lib/items";
import { r2, GetObjectCommand, DeleteObjectCommand } from "@/lib/r2";
import { requireOwnerId } from "@/lib/auth/owner";
import { isReadableUploadKey, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { LINKS_UNSUPPORTED_ERROR } from "@/lib/links";
import { runBriefJob } from "@/lib/brief";

export async function capture(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const file = formData.get("image");
  const rawUrl = ((formData.get("url") as string) ?? "").trim();
  const shareToken = ((formData.get("shareToken") as string) ?? "").trim();
  const uploadKey = ((formData.get("uploadKey") as string) ?? "").trim() || shareToken;

  if (uploadKey && isReadableUploadKey(ownerId, uploadKey)) {
    let itemId: string;
    try {
      const result = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: uploadKey }));
      const length = result.ContentLength ?? 0;
      if (length > MAX_UPLOAD_BYTES) redirect("/capture?error=bad-image");
      const buffer = Buffer.from(await result.Body!.transformToByteArray());
      const filename = ((formData.get("filename") as string) ?? "").trim() || "shared-image";
      itemId = await createImageItem({ ownerId, buffer, filename });
      await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: uploadKey }));
      revalidatePath("/");
    } catch {
      redirect("/capture?error=capture-failed");
    }
    after(async () => {
      await runBriefJob(itemId);
    });
    redirect(`/items/${itemId}`);
  }

  if (file instanceof File && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let itemId: string;
    try {
      itemId = await createImageItem({ ownerId, buffer, filename: file.name });
    } catch {
      redirect("/capture?error=bad-image");
    }
    revalidatePath("/");
    after(async () => {
      await runBriefJob(itemId);
    });
    redirect(`/items/${itemId}`);
  }

  if (rawUrl.length > 0) {
    redirect(`/capture?error=${LINKS_UNSUPPORTED_ERROR}`);
  }

  redirect("/capture?error=missing-image");
}
