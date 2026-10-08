"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createImageItem } from "@/lib/items";
import { createLinkedItem } from "@/lib/capture-url";
import { attachTags, parseTagSelection } from "@/lib/ontology";
import { isHttpUrl } from "@/lib/url";
import { r2, GetObjectCommand, DeleteObjectCommand } from "@/lib/r2";
import { requireOwnerId } from "@/lib/auth/owner";
import { isReadableUploadKey, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export async function capture(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const file = formData.get("image");
  const rawUrl = ((formData.get("url") as string) ?? "").trim();
  const shareToken = ((formData.get("shareToken") as string) ?? "").trim();
  const uploadKey = ((formData.get("uploadKey") as string) ?? "").trim() || shareToken;
  const tags = parseTagSelection(formData.get("tags"));

  if (uploadKey && isReadableUploadKey(ownerId, uploadKey)) {
    let itemId: string;
    try {
      const result = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: uploadKey }));
      const length = result.ContentLength ?? 0;
      if (length > MAX_UPLOAD_BYTES) redirect("/capture?error=bad-image");
      const buffer = Buffer.from(await result.Body!.transformToByteArray());
      const filename = ((formData.get("filename") as string) ?? "").trim() || "shared-image";
      itemId = await createImageItem({ ownerId, buffer, filename });
      await attachTags(ownerId, itemId, tags);
      await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: uploadKey }));
      revalidatePath("/");
    } catch {
      redirect("/capture?error=capture-failed");
    }
    redirect(`/capture?saved=${itemId}`);
  }

  if (file instanceof File && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let itemId: string;
    try {
      itemId = await createImageItem({ ownerId, buffer, filename: file.name });
    } catch {
      redirect("/capture?error=bad-image");
    }
    await attachTags(ownerId, itemId, tags);
    revalidatePath("/");
    redirect(`/capture?saved=${itemId}`);
  }

  if (rawUrl.length > 0) {
    if (!isHttpUrl(rawUrl)) {
      redirect("/capture?error=bad-url");
    }
    let result: Awaited<ReturnType<typeof createLinkedItem>>;
    try {
      result = await createLinkedItem({ ownerId, rawUrl, tags });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Blocked")) redirect("/capture?error=blocked-url");
      redirect("/capture?error=capture-failed");
    }
    revalidatePath("/");
    redirect(`/capture?saved=${result.itemId}`);
  }

  redirect("/capture?error=missing-image");
}
