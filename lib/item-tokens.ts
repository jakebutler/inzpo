import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemColors, type ColorRole } from "@/lib/db/schema";
import { hexToFamily, isHexColor, normalizeHex } from "@/lib/colors";
import { newId } from "@/lib/ids";
import { assertItemOwned } from "@/lib/auth/owner";
import { filledRoles, type RoleColors } from "@/lib/tokens";
import { REGION_ORIGIN } from "@/lib/derived-roles";

export interface TokenWrite {
  hex: string;
  role: ColorRole;
  pinX: number | null;
  pinY: number | null;
  name?: string | null;
}

export async function replaceItemTokens(
  ownerId: string,
  itemId: string,
  roles: RoleColors,
  pins: Partial<Record<ColorRole, { pinX: number; pinY: number }>> = {},
  origins: Partial<Record<ColorRole, string>> = {},
): Promise<void> {
  await assertItemOwned(ownerId, itemId);
  const writes: TokenWrite[] = [];
  for (const role of filledRoles(roles)) {
    const hex = roles[role];
    if (!hex || !isHexColor(hex)) continue;
    const pin = pins[role];
    writes.push({
      hex: normalizeHex(hex),
      role,
      pinX: pin?.pinX ?? null,
      pinY: pin?.pinY ?? null,
    });
  }
  await db.delete(itemColors).where(eq(itemColors.itemId, itemId));
  if (writes.length === 0) return;
  await db.insert(itemColors).values(
    writes.map((c, position) => ({
      id: newId(),
      itemId,
      hex: c.hex,
      family: hexToFamily(c.hex),
      origin: origins[c.role] === REGION_ORIGIN ? REGION_ORIGIN : origins[c.role] === "sampled" ? "sampled" : "extracted",
      position,
      name: c.name ?? hexToFamily(c.hex),
      role: c.role,
      pinX: c.pinX,
      pinY: c.pinY,
    })),
  );
}
