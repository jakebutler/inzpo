"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteItem } from "@/lib/items";
import { requireOwnerId } from "@/lib/auth/owner";

export async function deleteItemAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const id = formData.get("id");
  if (typeof id === "string" && id.startsWith("01")) {
    await deleteItem(ownerId, id);
    revalidatePath("/");
  }
  redirect("/");
}
