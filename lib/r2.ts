import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, ListBucketsCommand } from "@aws-sdk/client-s3";

export const MEDIA_VARIANTS = ["w1600", "w640", "w256"] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

export function r2() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function itemPrefix(itemId: string) {
  return `items/${itemId}/`;
}

export function originalKey(itemId: string, ext: string) {
  return `items/${itemId}/original.${ext}`;
}

export function variantKey(itemId: string, variant: MediaVariant) {
  return `items/${itemId}/${variant}.webp`;
}

export function articleKey(itemId: string) {
  return `items/${itemId}/article.html`;
}

export async function deletePrefix(prefix: string): Promise<void> {
  const client = r2();
  let cursor: string | undefined;
  const keys: string[] = [];
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET!, Prefix: prefix, ContinuationToken: cursor }),
    );
    for (const obj of page.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (cursor);
  for (let i = 0; i < keys.length; i += 1000) {
    await client.send(
      new DeleteObjectsCommand({ Bucket: process.env.R2_BUCKET!, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } }),
    );
  }
}

export { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand };
