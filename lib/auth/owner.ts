import { and, eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { boards, collections, facets, freeTags, items, smartCollections } from "@/lib/db/schema";
import { isClerkConfigured } from "@/lib/auth/clerk-configured";
import { devOwnerId } from "@/lib/auth/dev-bypass";
import { LEGACY_OWNER_ID, ownerClause } from "@/lib/auth/owner-ids";

export { isClerkConfigured, LEGACY_OWNER_ID, ownerClause };
export { ownerIdsFor, ownerSql } from "@/lib/auth/owner-ids";

export async function requireOwnerId(): Promise<string> {
  const bypass = devOwnerId();
  if (bypass) return bypass;
  if (!isClerkConfigured()) redirect("/login");
  const { userId } = await auth();
  if (!userId) redirect("/login");
  return userId;
}

export async function optionalOwnerId(): Promise<string | null> {
  const bypass = devOwnerId();
  if (bypass) return bypass;
  if (!isClerkConfigured()) return null;
  const { userId } = await auth();
  return userId ?? null;
}

export async function assertItemOwned(ownerId: string, itemId: string): Promise<void> {
  const rows = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, itemId), ownerClause(items.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
}

export async function assertCollectionOwned(ownerId: string, collectionId: string): Promise<void> {
  const rows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), ownerClause(collections.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
}

export async function assertBoardOwned(ownerId: string, boardId: string): Promise<void> {
  const rows = await db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.id, boardId), ownerClause(boards.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
}

export async function assertSmartCollectionOwned(ownerId: string, id: string): Promise<void> {
  const rows = await db
    .select({ id: smartCollections.id })
    .from(smartCollections)
    .where(and(eq(smartCollections.id, id), ownerClause(smartCollections.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
}

export async function assertFacetOwned(ownerId: string, facetId: string): Promise<void> {
  const rows = await db
    .select({ id: facets.id })
    .from(facets)
    .where(and(eq(facets.id, facetId), ownerClause(facets.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
}

export async function assertFreeTagOwned(ownerId: string, tagId: string): Promise<void> {
  const rows = await db
    .select({ id: freeTags.id })
    .from(freeTags)
    .where(and(eq(freeTags.id, tagId), ownerClause(freeTags.ownerId, ownerId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
}

/**
 * Reassign Jake's pre-Clerk rows to his Clerk user id once.
 * Triggered when the signed-in email matches JAKE_EMAIL.
 */
export async function claimLegacyLibrary(userId: string, email: string | undefined): Promise<void> {
  const claimEmail = process.env.JAKE_EMAIL?.trim().toLowerCase();
  if (!claimEmail || !email || email.trim().toLowerCase() !== claimEmail) return;
  if (userId === LEGACY_OWNER_ID) return;

  const existing = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.ownerId, LEGACY_OWNER_ID))
    .limit(1);
  const leftover =
    existing[0] ??
    (await db.select({ id: collections.id }).from(collections).where(eq(collections.ownerId, LEGACY_OWNER_ID)).limit(1))[0] ??
    (await db.select({ id: boards.id }).from(boards).where(eq(boards.ownerId, LEGACY_OWNER_ID)).limit(1))[0] ??
    (await db.select({ id: facets.id }).from(facets).where(eq(facets.ownerId, LEGACY_OWNER_ID)).limit(1))[0];
  if (!leftover) return;

  await db.update(items).set({ ownerId: userId }).where(eq(items.ownerId, LEGACY_OWNER_ID));
  await db.update(collections).set({ ownerId: userId }).where(eq(collections.ownerId, LEGACY_OWNER_ID));
  await db.update(boards).set({ ownerId: userId }).where(eq(boards.ownerId, LEGACY_OWNER_ID));
  await db.update(smartCollections).set({ ownerId: userId }).where(eq(smartCollections.ownerId, LEGACY_OWNER_ID));
  await db.update(facets).set({ ownerId: userId }).where(eq(facets.ownerId, LEGACY_OWNER_ID));
  await db.update(freeTags).set({ ownerId: userId }).where(eq(freeTags.ownerId, LEGACY_OWNER_ID));
}

export async function claimLegacyIfNeeded(): Promise<void> {
  if (!isClerkConfigured()) return;
  const { userId } = await auth();
  if (!userId) return;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  await claimLegacyLibrary(userId, email);
}
