"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { itemFacetValues, itemFreeTags, itemSources, items } from "@/lib/db/schema";
import { attachTags, parseTagSelection } from "@/lib/ontology";
import { isHttpUrl, normalizeUrl } from "@/lib/url";

export async function updateItem(formData: FormData): Promise<void> {
  const id = formData.get("itemId");
  if (typeof id !== "string") return;

  const title = ((formData.get("title") as string) ?? "").trim().slice(0, 200);
  const note = ((formData.get("note") as string) ?? "").slice(0, 5000);
  const sourceTitle = ((formData.get("sourceTitle") as string) ?? "").trim().slice(0, 200);
  const sourceDescription = ((formData.get("sourceDescription") as string) ?? "").slice(0, 1000);
  const sourceUrl = ((formData.get("sourceUrl") as string) ?? "").trim();

  await db
    .update(items)
    .set({ title: title.length > 0 ? title : null, note: note.length > 0 ? note : null, updatedAt: new Date() })
    .where(eq(items.id, id));

  if (sourceUrl.length > 0 && isHttpUrl(sourceUrl)) {
    await db
      .update(itemSources)
      .set({ url: sourceUrl, urlNormalized: normalizeUrl(sourceUrl), title: sourceTitle || null, description: sourceDescription || null })
      .where(eq(itemSources.itemId, id));
  } else if (sourceTitle.length > 0 || sourceDescription.length > 0) {
    await db
      .update(itemSources)
      .set({ title: sourceTitle || null, description: sourceDescription || null })
      .where(eq(itemSources.itemId, id));
  }

  // tags: replace selections wholesale with the tray payload
  const selection = parseTagSelection(formData.get("tags"));
  await db.delete(itemFacetValues).where(eq(itemFacetValues.itemId, id));
  await db.delete(itemFreeTags).where(eq(itemFreeTags.itemId, id));
  await attachTags(id, selection);

  revalidatePath(`/items/${id}`);
  revalidatePath("/");
  redirect(`/items/${id}`);
}
