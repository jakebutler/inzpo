import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { requireOwnerId } from "@/lib/auth/owner";
import { getItemDetail } from "@/lib/items";
import { readBriefJob } from "@/lib/brief";
import { r2 } from "@/lib/r2";
import { briefMarkdown, tokensCss, tokensJson, textureSvg } from "@/lib/kit-export";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  const item = await getItemDetail(ownerId, id);
  if (!item) return new NextResponse("Not found", { status: 404 });
  let tile: Buffer | null = null;
  if (item.media?.tileKey) {
    try {
      const obj = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: item.media.tileKey }));
      tile = Buffer.from(await obj.Body!.transformToByteArray());
    } catch {
      tile = null;
    }
  }
  const brief = await readBriefJob(id);
  const zip = new JSZip();
  zip.file("tokens.json", tokensJson(item));
  zip.file("tokens.css", tokensCss(item));
  zip.file("brief.md", briefMarkdown(brief?.text ?? item.note, brief?.status ?? "none"));
  zip.file("texture.svg", textureSvg(tile));
  const body = await zip.generateAsync({ type: "uint8array" });
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="kit.zip"`,
    },
  });
}
