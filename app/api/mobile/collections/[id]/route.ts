import { NextResponse } from "next/server";
import type { MobileCollection } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { listCollections } from "@/lib/collections";
import { EMPTY_FILTER } from "@/lib/filter";
import { getItemDetail, getWallItems } from "@/lib/items";
import { buildMobileKit } from "@/lib/mobile-kit";
import { mobileError, mobileServerError, type MobileKitContext } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const collection = (await listCollections(auth.ownerId)).find((collection) => collection.id === id);
    if (!collection) return mobileError("Not found", 404);
    const items = await getWallItems(auth.ownerId, {
      ...EMPTY_FILTER, kinds: { photo: "include", screenshot: "include" },
    }, id);
    const kits: MobileCollection["kits"] = [];
    // Bound database/signing fan-out for collections with many kits.
    for (let offset = 0; offset < items.length; offset += 8) {
      const batch = await Promise.all(items.slice(offset, offset + 8).map(async ({ id: kitId }) => {
        // Recheck ownership/readiness if an item changed after the wall query.
        const item = await getItemDetail(auth.ownerId, kitId);
        if (!item || (item.kind !== "photo" && item.kind !== "screenshot")) return null;
        const { id, title, roles, photo } = await buildMobileKit(auth.ownerId, item);
        return { id, title, roles, photo: photo ? { url: photo.url } : null };
      }));
      kits.push(...batch.filter((kit): kit is NonNullable<typeof kit> => kit !== null));
    }
    return NextResponse.json<MobileCollection>({ id, name: collection.name, kits });
  } catch (error) {
    return mobileServerError(error);
  }
}
