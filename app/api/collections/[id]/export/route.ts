import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { requireOwnerId } from "@/lib/auth/owner";
import { getItemDetail, getWallItems } from "@/lib/items";
import { collectionExists } from "@/lib/collections";
import { EMPTY_FILTER } from "@/lib/filter";
import { readBriefJob } from "@/lib/brief";
import { r2 } from "@/lib/r2";
import { briefMarkdown, tokensCss, tokensJson, textureSvg } from "@/lib/kit-export";
import { kitDisplayName } from "@/lib/kit-name";

export const dynamic = "force-dynamic";

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "kit";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  if (!(await collectionExists(ownerId, id))) return new NextResponse("Not found", { status: 404 });
  const wall = await getWallItems(ownerId, EMPTY_FILTER, id);
  const zip = new JSZip();
  const used = new Set<string>();
  for (const row of wall) {
    const item = await getItemDetail(ownerId, row.id);
    if (!item) continue;
    let tile: Buffer | null = null;
    if (item.media?.tileKey) {
      try {
        const obj = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: item.media.tileKey }));
        tile = Buffer.from(await obj.Body!.transformToByteArray());
      } catch {
        tile = null;
      }
    }
    const brief = await readBriefJob(item.id);
    const name = kitDisplayName({
      title: item.title,
      briefText: brief?.text ?? item.note,
      pending: brief?.status === "pending",
    });
    let folder = slugify(name);
    if (used.has(folder)) folder = `${folder}-${item.id.slice(-6).toLowerCase()}`;
    used.add(folder);
    zip.file(`${folder}/tokens.json`, tokensJson(item));
    zip.file(`${folder}/tokens.css`, tokensCss(item));
    zip.file(`${folder}/brief.md`, briefMarkdown(brief?.text ?? item.note, brief?.status ?? "none"));
    zip.file(`${folder}/texture.svg`, textureSvg(tile));
  }
  const body = await zip.generateAsync({ type: "uint8array" });
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="collection.zip"`,
    },
  });
}
