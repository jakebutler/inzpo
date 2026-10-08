import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, collectionItems } from "@/lib/db/schema";
import { assertItemOwned, ownerClause } from "@/lib/auth/owner";

export async function getItemCollections(ownerId: string, itemId: string): Promise<Array<{ id: string; name: string }>> {
  await assertItemOwned(ownerId, itemId);
  return db
    .select({ id: collections.id, name: collections.name })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(and(eq(collectionItems.itemId, itemId), ownerClause(collections.ownerId, ownerId)))
    .orderBy(collections.name);
}

export async function listCollectionOptions(ownerId: string): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(ownerClause(collections.ownerId, ownerId))
    .orderBy(collections.name);
}
