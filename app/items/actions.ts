"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteItem } from "@/lib/items";

export async function deleteItemAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string" && id.startsWith("01")) {
    await deleteItem(id);
    revalidatePath("/");
  }
  redirect("/");
}
