import { NextResponse } from "next/server";
import type { CollectionSummary } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { listCollections } from "@/lib/collections";
import { mobileServerError } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const collections = await listCollections(auth.ownerId);
    return NextResponse.json<CollectionSummary[]>(collections.map(({ id, name, count }) => ({ id, name, count })));
  } catch (error) {
    return mobileServerError(error);
  }
}
