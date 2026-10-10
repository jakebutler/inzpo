import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SaveKitRequest, SaveKitResponse } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { assertItemOwned } from "@/lib/auth/owner";
import { saveKitTitle } from "@/lib/kit-title";
import { addToCollection, createCollection } from "@/lib/collections";
import { mobileError, mobileServerError, readMobileJson, type MobileKitContext } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const body = await readMobileJson(request);
  if (!body || (body.collectionId !== undefined && typeof body.collectionId !== "string") ||
    (body.newName !== undefined && typeof body.newName !== "string") ||
    (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 100))) {
    return mobileError("collectionId and newName must be strings; title must be 1–100 characters", 400);
  }
  const input: SaveKitRequest = {
    title: (body.title as string | undefined)?.trim(),
    collectionId: (body.collectionId as string | undefined)?.trim(),
    newName: (body.newName as string | undefined)?.trim(),
  };
  if (!input.collectionId && !input.newName) return mobileError("collectionId or newName is required", 400);
  const { id } = await params;
  try {
    // Check ownership before creating a collection, so an invalid kit leaves no collection behind.
    await assertItemOwned(auth.ownerId, id);
    const collectionId = input.collectionId || await createCollection(auth.ownerId, input.newName!);
    await addToCollection(auth.ownerId, collectionId, id);
    if (input.title) await saveKitTitle(auth.ownerId, id, input.title);
    revalidatePath(`/items/${id}`);
    revalidatePath("/");
    return NextResponse.json<SaveKitResponse>({ collectionId });
  } catch (error) {
    return mobileServerError(error);
  }
}
