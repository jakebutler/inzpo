import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { rolesFromColors, type MobileKit } from "@inzpo/shared";
import type { ItemDetail } from "@/lib/items";
import { getItemCollections } from "@/lib/item-collections";
import { readBriefJob } from "@/lib/brief";
import { primaryKitTitle } from "@/lib/kit-name";
import { r2, GetObjectCommand } from "@/lib/r2";
import { pendingBrief } from "@/lib/mobile-api";
import { upgradeMobilePalette } from "@/lib/mobile-palette";

export async function buildMobileKit(ownerId: string, item: ItemDetail): Promise<MobileKit> {
  item = await upgradeMobilePalette(item);
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
  const roles = rolesFromColors(item.colors);
  return {
    id: item.id,
    // Automatic names depend only on the seeded photo palette. Brief prose,
    // model labels and their ordering must never rename a fresh capture.
    // Keep preserves the explicit name submitted when saving a collection kit.
    title: collections.length && item.title?.trim() ? item.title.trim() : primaryKitTitle(roles.primary),
    photo,
    roles,
    colors: item.colors.map(({ hex, role, name, origin, pinX, pinY }) => ({ hex, role, name, origin, pinX, pinY })),
    brief,
    collectionIds: collections.map((collection) => collection.id),
  };
}
