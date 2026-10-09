import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { rolesFromColors, type MobileKit } from "@inzpo/shared";
import type { ItemDetail } from "@/lib/items";
import { getItemCollections } from "@/lib/item-collections";
import { readBriefJob } from "@/lib/brief";
import { kitDisplayName } from "@/lib/kit-name";
import { r2, GetObjectCommand } from "@/lib/r2";
import { pendingBrief } from "@/lib/mobile-api";

export async function buildMobileKit(ownerId: string, item: ItemDetail): Promise<MobileKit> {
  const id = item.id;
  const [job, collections] = await Promise.all([readBriefJob(id), getItemCollections(ownerId, id)]);
  const brief = job ?? pendingBrief();
  const photo: MobileKit["photo"] = item.media ? {
    url: await getSignedUrl(r2(), new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!, Key: item.media.displayKey ?? item.media.originalKey,
    }), { expiresIn: 15 * 60 }),
    width: item.media.width,
    height: item.media.height,
    placeholder: item.media.placeholder,
  } : null;
  return {
    id: item.id,
    title: kitDisplayName({ title: item.title, briefText: brief.text, namedColors: brief.namedColors,
      pending: brief.status === "pending" || brief.stub }),
    photo,
    roles: rolesFromColors(item.colors),
    colors: item.colors.map(({ hex, role, name, origin, pinX, pinY }) => ({ hex, role, name, origin, pinX, pinY })),
    brief,
    collectionIds: collections.map((collection) => collection.id),
  };
}
