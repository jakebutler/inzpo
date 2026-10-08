import { NextResponse } from "next/server";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { getItemDetail } from "@/lib/items";
import { buildMobileKit } from "@/lib/mobile-kit";
import { mobileError, mobileServerError, type MobileKitContext } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const item = await getItemDetail(auth.ownerId, id);
    if (!item || (item.kind !== "photo" && item.kind !== "screenshot")) return mobileError("Not found", 404);
    return NextResponse.json(await buildMobileKit(auth.ownerId, item));
  } catch (error) {
    return mobileServerError(error);
  }
}
