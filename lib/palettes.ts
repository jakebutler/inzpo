import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { itemColors, items, origins } from "@/lib/db/schema";
import { hexToFamily } from "@/lib/colors";
import { newId } from "@/lib/ids";

export async function createPaletteFromItem(sourceItemId: string): Promise<string> {
  const colors = await db
    .select({ hex: itemColors.hex, family: itemColors.family })
    .from(itemColors)
    .where(eq(itemColors.itemId, sourceItemId));
  if (colors.length === 0) throw new Error("No extracted colors on source item");

  const paletteId = newId();
  await db.insert(items).values({ id: paletteId, kind: "palette", captureState: "ready" });
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

export async function createEmptyPalette(name?: string): Promise<string> {
  const paletteId = newId();
  await db.insert(items).values({
    id: paletteId,
    kind: "palette",
    title: name ?? "New palette",
    captureState: "ready",
  });
  return paletteId;
}

export async function getOrigin(itemId: string): Promise<string | null> {
  const rows = await db.select({ originItemId: origins.originItemId }).from(origins).where(eq(origins.derivedItemId, itemId)).limit(1);
  return rows[0]?.originItemId ?? null;
}

export async function getDerivedItems(itemId: string): Promise<Array<{ id: string; kind: string }>> {
  const rows = await db.execute(sql`
    select i.id, i.kind from origins o join items i on i.id = o.derived_item_id
    where o.origin_item_id = ${itemId}
  `);
  return rows.rows as Array<{ id: string; kind: string }>;
}

export async function updatePaletteColors(itemId: string, colors: Array<{ hex: string }>): Promise<void> {
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

export async function getPaletteTitle(itemId: string): Promise<string | null> {
  const rows = await db.select({ title: items.title }).from(items).where(eq(items.id, itemId)).limit(1);
  return rows[0]?.title ?? null;
}
