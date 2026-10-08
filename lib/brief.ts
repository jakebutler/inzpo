import { sampledColors } from "@/lib/derived-roles";
import { eq } from "drizzle-orm";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, briefKey, variantKey } from "@/lib/r2";
import { assertItemOwned } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import { itemColors } from "@/lib/db/schema";
import sharp from "sharp";
import { parseNamedColorCandidates, parseNamedColors, type NamedColor } from "@/lib/brief-copy";
import { snapNamedColors } from "@/lib/named-color-snap";
import { extractPalette } from "@/lib/palette-extract";
import { sanitizeBriefSubject } from "@/lib/brief-subject";
import { persistKitTitleFromBrief } from "@/lib/kit-title";
import {
  BRIEF_IMAGE_EXPIRES_S,
  BRIEF_REQUEST,
  BriefTimeoutError,
  briefModelId,
  bytesToDataUrl,
  requestBriefCompletionWithRetry,
} from "@/lib/brief-request";

export type BriefStatus = "pending" | "ready" | "failed";

export interface BriefJob {
  status: BriefStatus;
  text: string | null;
  subject?: string | null;
  namedHexes: string[];
  namedColors: NamedColor[];
  stub: boolean;
  updatedAt: number;
}

function jobPayload(
  partial: Omit<BriefJob, "namedHexes" | "updatedAt"> & { namedColors: NamedColor[] },
): BriefJob {
  return {
    ...partial,
    namedHexes: partial.namedColors.map((c) => c.hex),
    updatedAt: Date.now(),
  };
}

export async function writeBriefJob(itemId: string, job: BriefJob): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: briefKey(itemId),
      Body: JSON.stringify(job),
      ContentType: "application/json",
    }),
  );
}

export async function readBriefJob(itemId: string): Promise<BriefJob | null> {
  try {
    const result = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: briefKey(itemId) }));
    const raw = await result.Body!.transformToString();
    const parsed = JSON.parse(raw) as Partial<BriefJob>;
    if (parsed.status !== "pending" && parsed.status !== "ready" && parsed.status !== "failed") return null;
    const namedColors = parseNamedColors(parsed.namedColors, parsed.namedHexes ?? []);
    return {
      status: parsed.status,
      text: typeof parsed.text === "string" ? parsed.text : null,
      ...(parsed.subject === undefined ? {} : { subject: sanitizeBriefSubject(parsed.subject) }),
      namedColors,
      namedHexes: namedColors.map((c) => c.hex),
      stub: parsed.stub === true,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function startBriefJob(ownerId: string, itemId: string): Promise<void> {
  await assertItemOwned(ownerId, itemId);
  if (await readBriefJob(itemId)) return;
  await writeBriefJob(
    itemId,
    jobPayload({ status: "pending", text: null, namedColors: [], stub: false }),
  );
}

async function filledHexes(itemId: string) {
  const rows = await db.select({
    hex: itemColors.hex, role: itemColors.role, origin: itemColors.origin,
    pinX: itemColors.pinX, pinY: itemColors.pinY,
  }).from(itemColors).where(eq(itemColors.itemId, itemId));
  return sampledColors(rows).map((r) => ({ hex: r.hex.toLowerCase(), pinX: r.pinX, pinY: r.pinY }));
}

async function readW640Image(itemId: string): Promise<{ imageUrl: string; bytes: Buffer | null } | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  const bucket = process.env.R2_BUCKET;
  if (!bucket) return null;
  const key = variantKey(itemId, "w640");
  let bytes: Buffer | null = null;
  try {
    const result = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = result.Body;
    if (!body) throw new Error("empty object");
    bytes = Buffer.from(await body.transformToByteArray());
    const compact = await sharp(bytes, { failOn: "error" })
      .rotate()
      .resize({
        width: BRIEF_REQUEST.visionEdgePx,
        height: BRIEF_REQUEST.visionEdgePx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: BRIEF_REQUEST.visionJpegQuality, chromaSubsampling: "4:2:0" })
      .toBuffer();
    return { imageUrl: bytesToDataUrl(compact, "image/jpeg"), bytes };
  } catch {
    try {
      const imageUrl = await getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: BRIEF_IMAGE_EXPIRES_S,
      });
      return { imageUrl, bytes };
    } catch {
      return null;
    }
  }
}

/** Compact JPEG data URL for vision, or a short-lived signed GET if the object cannot be read. */
export async function w640ImageUrl(itemId: string): Promise<string | null> {
  return (await readW640Image(itemId))?.imageUrl ?? null;
}

function stubJob(): BriefJob {
  return jobPayload({
    status: "ready",
    text: null,
    namedColors: [],
    stub: true,
  });
}

/** Runs off the request. Without a key, Save stays unblocked and the brief stays empty. */
export async function runBriefJob(itemId: string, { retry = false } = {}): Promise<BriefJob> {
  // Colour edits and repeat background calls must preserve a completed brief.
  if (!retry) {
    const existing = await readBriefJob(itemId);
    if (existing && existing.status !== "pending") return existing;
  }
  if (retry) {
    await writeBriefJob(itemId, jobPayload({ status: "pending", text: null, namedColors: [], stub: false }));
  }
  const key = process.env.DO_INFERENCE_API_KEY;
  const base = process.env.DO_INFERENCE_BASE_URL ?? "https://inference.do-ai.run/v1";
  const model = briefModelId();
  if (!key) {
    const stub = stubJob();
    await writeBriefJob(itemId, stub);
    await persistKitTitleFromBrief(itemId, stub);
    return stub;
  }
  const filled = await filledHexes(itemId).catch(() => []);
  try {
    const image = await readW640Image(itemId);
    if (!image) throw new Error("brief image missing");
    const parsed = await requestBriefCompletionWithRetry({
      imageUrl: image.imageUrl,
      keptHexes: filled.map((color) => color.hex),
      apiKey: key,
      baseUrl: base,
      model,
    });
    const palette = image.bytes
      ? await extractPalette(image.bytes).catch(() => null)
      : null;
    const namedColors = snapNamedColors(
      parseNamedColorCandidates(parsed.namedColors, parsed.namedHexes), palette?.regions ?? [], filled, palette ?? {},
    );
    const ready = jobPayload({
      status: "ready",
      text: parsed.text,
      subject: sanitizeBriefSubject(parsed.subject),
      namedColors,
      stub: false,
    });
    await writeBriefJob(itemId, ready);
    await persistKitTitleFromBrief(itemId, ready);
    return ready;
  } catch (err) {
    if (err instanceof BriefTimeoutError) {
      console.error("brief timed out", itemId);
    }
    const failed = jobPayload({ status: "failed", text: null, namedColors: [], stub: false });
    await writeBriefJob(itemId, failed);
    await persistKitTitleFromBrief(itemId, failed);
    return failed;
  }
}
