"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createImageItem } from "@/lib/items";

export async function captureImage(formData: FormData): Promise<void> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/capture?error=missing-image");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await createImageItem({ buffer, filename: file.name });
  } catch {
    redirect("/capture?error=bad-image");
  }
  revalidatePath("/");
  redirect("/");
}
