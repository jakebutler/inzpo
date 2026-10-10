"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPaletteFromItem, updatePaletteColors } from "@/lib/palettes";
import { requireOwnerId } from "@/lib/auth/owner";

export async function saveExtractedAsPaletteAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const itemId = formData.get("itemId");
  if (typeof itemId !== "string") return;
  const paletteId = await createPaletteFromItem(ownerId, itemId);
  revalidatePath("/");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${paletteId}`);
}

export async function updatePaletteColorsAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const itemId = formData.get("itemId");
  const raw = formData.get("colors");
  if (typeof itemId !== "string" || typeof raw !== "string") return;
  try {
    const parsed = JSON.parse(raw) as Array<{ hex: string }>;
    const colors = parsed
      .filter((c) => c && typeof c.hex === "string" && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.hex))
      .map((c) => ({ hex: c.hex.startsWith("#") ? c.hex : `#${c.hex}` }));
    if (colors.length > 0) await updatePaletteColors(ownerId, itemId, colors);
  } catch {
    // ignore malformed payloads
  }
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
}
