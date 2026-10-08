import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, collectionItems } from "@/lib/db/schema";
import { assertItemOwned, ownerClause } from "@/lib/auth/owner";

export async function getItemCollections(ownerId: string, itemId: string, order: "name" | "recent" = "name"): Promise<Array<{ id: string; name: string }>> {
  await assertItemOwned(ownerId, itemId);
  return db
    .select({ id: collections.id, name: collections.name })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(and(eq(collectionItems.itemId, itemId), ownerClause(collections.ownerId, ownerId)))
    .orderBy(...(order === "recent"
      // No per-membership save time is stored (no schema change); newest collection first.
      ? [desc(collections.createdAt), desc(collections.id)]
      : [collections.name]));
}

export async function listCollectionOptions(ownerId: string): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(ownerClause(collections.ownerId, ownerId))
    .orderBy(collections.name);
}
