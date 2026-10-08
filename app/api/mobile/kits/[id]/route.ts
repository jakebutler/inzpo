import { NextResponse } from "next/server";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { rolesFromColors, type MobileKit } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { getItemDetail } from "@/lib/items";
import { getItemCollections } from "@/lib/item-collections";
import { readBriefJob } from "@/lib/brief";
import { kitDisplayName } from "@/lib/kit-name";
import { r2, GetObjectCommand } from "@/lib/r2";
import { mobileError, mobileServerError, pendingBrief, type MobileKitContext } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const item = await getItemDetail(auth.ownerId, id);
    if (!item || (item.kind !== "photo" && item.kind !== "screenshot")) return mobileError("Not found", 404);
    const [job, collections] = await Promise.all([readBriefJob(id), getItemCollections(auth.ownerId, id)]);
    const brief = job ?? pendingBrief();
    const photo: MobileKit["photo"] = item.media ? {
      url: await getSignedUrl(r2(), new GetObjectCommand({
        Bucket: process.env.R2_BUCKET!, Key: item.media.displayKey ?? item.media.originalKey,
      }), { expiresIn: 15 * 60 }),
      width: item.media.width,
      height: item.media.height,
      placeholder: item.media.placeholder,
    } : null;
    return NextResponse.json<MobileKit>({
      id: item.id,
      title: kitDisplayName({ title: item.title, briefText: brief.text, namedColors: brief.namedColors,
        pending: brief.status === "pending" || brief.stub }),
      photo,
      roles: rolesFromColors(item.colors),
      colors: item.colors.map(({ hex, role, name, origin }) => ({ hex, role, name, origin })),
      brief,
      collectionIds: collections.map((collection) => collection.id),
    });
  } catch (error) {
    return mobileServerError(error);
  }
}
