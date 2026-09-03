"use server";

import { revalidatePath } from "next/cache";
import {
  createFacetValue,
  mergeFacetValues,
  promoteFreeTag,
  removeFacetValue,
  removeFreeTag,
  renameFacetValue,
  renameFreeTag,
} from "@/lib/vocab";

function refresh() {
  revalidatePath("/vocab");
  revalidatePath("/");
}

export async function createFacetValueAction(formData: FormData): Promise<void> {
  const facetId = formData.get("facetId");
  const value = formData.get("value");
  if (typeof facetId === "string" && typeof value === "string") await createFacetValue(facetId, value);
  refresh();
}

export async function renameFacetValueAction(formData: FormData): Promise<void> {
  const facetId = formData.get("facetId");
  const oldValue = formData.get("oldValue");
  const newValue = formData.get("newValue");
  if (typeof facetId === "string" && typeof oldValue === "string" && typeof newValue === "string") {
    await renameFacetValue(facetId, oldValue, newValue);
  }
  refresh();
}

export async function mergeFacetValuesAction(formData: FormData): Promise<void> {
  const facetId = formData.get("facetId");
  const survivorId = formData.get("survivorId");
  const merged = formData.getAll("mergeIds").filter((v): v is string => typeof v === "string");
  if (typeof facetId === "string" && typeof survivorId === "string" && merged.length > 0) {
    await mergeFacetValues(facetId, survivorId, merged.filter((id) => id !== survivorId));
  }
  refresh();
}

export async function removeFacetValueAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string") {
    try {
      await removeFacetValue(id);
    } catch {
      // gated server-side too; UI shows the reason via live counts
    }
  }
  refresh();
}

export async function renameFreeTagAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const newName = formData.get("newValue");
  if (typeof id === "string" && typeof newName === "string") await renameFreeTag(id, newName);
  refresh();
}

export async function removeFreeTagAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string") {
    try {
      await removeFreeTag(id);
    } catch {
      // gated
    }
  }
  refresh();
}

export async function promoteFreeTagAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const facetId = formData.get("facetId");
  if (typeof id === "string" && typeof facetId === "string") await promoteFreeTag(id, facetId);
  refresh();
}
