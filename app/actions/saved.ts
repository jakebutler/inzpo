"use server";

import { revalidatePath } from "next/cache";
import { parseFilterParam } from "@/lib/filter";
import { deleteSavedSearch, renameSavedSearch, saveSearch } from "@/lib/saved-searches";

export async function saveSearchAction(formData: FormData): Promise<void> {
  const name = ((formData.get("name") as string) ?? "").trim().slice(0, 80);
  const state = parseFilterParam(formData.get("f") as string | null);
  if (name.length > 0) await saveSearch(name, state);
  revalidatePath("/");
}

export async function renameSavedAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const name = ((formData.get("name") as string) ?? "").trim().slice(0, 80);
  if (typeof id === "string" && name.length > 0) await renameSavedSearch(id, name);
  revalidatePath("/");
}

export async function deleteSavedAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string") await deleteSavedSearch(id);
  revalidatePath("/");
}
