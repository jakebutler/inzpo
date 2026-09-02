"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addToCollection, createCollection, deleteCollection, removeFromCollection, renameCollection } from "@/lib/collections";

export async function addToCollectionAction(formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  const collectionId = formData.get("collectionId");
  const newName = ((formData.get("newName") as string) ?? "").trim();
  if (typeof itemId !== "string") return;
  let cid: string | null = typeof collectionId === "string" && collectionId ? collectionId : null;
  if (!cid && newName.length > 0) cid = await createCollection(newName);
  if (cid) await addToCollection(cid, itemId);
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
}

export async function removeFromCollectionAction(formData: FormData): Promise<void> {
  const itemId = formData.get("itemId");
  const collectionId = formData.get("collectionId");
  if (typeof itemId === "string" && typeof collectionId === "string") {
    await removeFromCollection(collectionId, itemId);
  }
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
}

export async function renameCollectionAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const name = ((formData.get("name") as string) ?? "").trim();
  if (typeof id === "string" && name.length > 0) await renameCollection(id, name);
  revalidatePath("/");
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string") await deleteCollection(id);
  revalidatePath("/");
  redirect("/");
}
