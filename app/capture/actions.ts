"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createImageItem } from "@/lib/items";
import { createLinkedItem } from "@/lib/capture-url";
import { attachTags, parseTagSelection } from "@/lib/ontology";
import { isHttpUrl } from "@/lib/url";

export async function capture(formData: FormData): Promise<void> {
  const file = formData.get("image");
  const rawUrl = ((formData.get("url") as string) ?? "").trim();
  const tags = parseTagSelection(formData.get("tags"));

  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    let itemId: string;
    try {
      itemId = await createImageItem({ buffer, filename: file.name });
    } catch {
      redirect("/capture?error=bad-image");
    }
    await attachTags(itemId, tags);
    revalidatePath("/");
    redirect(`/capture?saved=${itemId}`);
  }

  if (rawUrl.length > 0) {
    if (!isHttpUrl(rawUrl)) {
      redirect("/capture?error=bad-url");
    }
    let result: Awaited<ReturnType<typeof createLinkedItem>>;
    try {
      result = await createLinkedItem({ rawUrl, tags });
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
