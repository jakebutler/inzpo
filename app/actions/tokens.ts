"use server";

import { revalidatePath } from "next/cache";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { requireOwnerId } from "@/lib/auth/owner";
import { replaceItemTokens } from "@/lib/item-tokens";
import { emptyRoles, type RoleColors } from "@/lib/tokens";

function parseRoles(raw: unknown): RoleColors | null {
  if (!raw || typeof raw !== "object") return null;
  const roles = emptyRoles();
  for (const role of COLOR_ROLES) {
    const value = (raw as Record<string, unknown>)[role];
    if (typeof value === "string" && value.length > 0) roles[role] = value;
    else roles[role] = null;
  }
  return roles;
}

export async function saveItemTokensAction(formData: FormData): Promise<void> {
  const ownerId = await requireOwnerId();
  const itemId = formData.get("itemId");
  const raw = formData.get("roles");
  if (typeof itemId !== "string" || typeof raw !== "string") return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const roles = parseRoles(parsed);
  if (!roles) return;
  const pinsRaw = formData.get("pins");
  const pins: Partial<Record<ColorRole, { pinX: number; pinY: number }>> = {};
  if (typeof pinsRaw === "string") {
    try {
      const obj = JSON.parse(pinsRaw) as Record<string, { pinX?: number; pinY?: number }>;
      for (const role of COLOR_ROLES) {
        const pin = obj[role];
        const pinX = pin?.pinX;
        const pinY = pin?.pinY;
        if (typeof pinX === "number" && typeof pinY === "number" && Number.isFinite(pinX) && Number.isFinite(pinY)) {
          pins[role] = { pinX, pinY };
        }
      }
    } catch {
      // ignore malformed pins; colors still save
    }
  }
  await replaceItemTokens(ownerId, itemId, roles, pins);
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/");
}
