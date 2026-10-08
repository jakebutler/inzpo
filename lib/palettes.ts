import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemColors, items, origins } from "@/lib/db/schema";
import { hexToFamily } from "@/lib/colors";
import { newId } from "@/lib/ids";
import { assertItemOwned, ownerClause } from "@/lib/auth/owner";

export async function createPaletteFromItem(ownerId: string, sourceItemId: string): Promise<string> {
  await assertItemOwned(ownerId, sourceItemId);
  const colors = await db
    .select({ hex: itemColors.hex, family: itemColors.family })
    .from(itemColors)
    .where(eq(itemColors.itemId, sourceItemId));
  if (colors.length === 0) throw new Error("No extracted colors on source item");

  const paletteId = newId();
  await db.insert(items).values({ id: paletteId, ownerId, kind: "palette", captureState: "ready" });
  await db.insert(itemColors).values(
    colors.map((c, index) => ({
      id: newId(),
      itemId: paletteId,
      hex: c.hex,
      family: c.family,
      origin: "palette",
      position: index,
    })),
  );
  await db.insert(origins).values({ derivedItemId: paletteId, originItemId: sourceItemId });
  return paletteId;
}

export async function createEmptyPalette(ownerId: string, name?: string): Promise<string> {
  const paletteId = newId();
  await db.insert(items).values({
    id: paletteId,
    ownerId,
    kind: "palette",
    title: name ?? "New palette",
    captureState: "ready",
  });
  return paletteId;
}

export async function getOrigin(ownerId: string, itemId: string): Promise<string | null> {
  await assertItemOwned(ownerId, itemId);
  const rows = await db.select({ originItemId: origins.originItemId }).from(origins).where(eq(origins.derivedItemId, itemId)).limit(1);
  return rows[0]?.originItemId ?? null;
}

export async function getDerivedItems(ownerId: string, itemId: string): Promise<Array<{ id: string; kind: string }>> {
  await assertItemOwned(ownerId, itemId);
  const rows = await db.execute(sql`
    select i.id, i.kind from origins o join items i on i.id = o.derived_item_id
    where o.origin_item_id = ${itemId}
  `);
  return rows.rows as Array<{ id: string; kind: string }>;
}

export async function updatePaletteColors(ownerId: string, itemId: string, colors: Array<{ hex: string }>): Promise<void> {
  await assertItemOwned(ownerId, itemId);
  if (colors.length === 0) throw new Error("A palette needs at least one color");
  await db.delete(itemColors).where(eq(itemColors.itemId, itemId));
  await db.insert(itemColors).values(
    colors.map((c, index) => ({
      id: newId(),
      itemId,
      hex: c.hex,
      family: familyOf(c.hex),
      origin: "palette",
      position: index,
    })),
  );
}

function familyOf(hex: string): string {
  return hexToFamily(hex);
}

export async function getPaletteTitle(ownerId: string, itemId: string): Promise<string | null> {
  const rows = await db
    .select({ title: items.title })
    .from(items)
    .where(and(eq(items.id, itemId), ownerClause(items.ownerId, ownerId)))
    .limit(1);
  return rows[0]?.title ?? null;
}
