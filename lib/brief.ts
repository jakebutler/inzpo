import { eq } from "drizzle-orm";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, briefKey, variantKey } from "@/lib/r2";
import { assertItemOwned } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import { itemColors } from "@/lib/db/schema";
import sharp from "sharp";
import { parseNamedColors, type NamedColor } from "@/lib/brief-copy";
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
      ...(typeof parsed.subject === "string" ? { subject: parsed.subject } : {}),
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
  await writeBriefJob(
    itemId,
    jobPayload({ status: "pending", text: null, namedColors: [], stub: false }),
  );
}

async function filledHexes(itemId: string): Promise<Set<string>> {
  const rows = await db.select({ hex: itemColors.hex }).from(itemColors).where(eq(itemColors.itemId, itemId));
  return new Set(rows.map((r) => r.hex.toLowerCase()));
}

/** Compact JPEG data URL for vision, or a short-lived signed GET if the object cannot be read. */
export async function w640ImageUrl(itemId: string): Promise<string | null> {
  if (typeof itemId !== "string" || itemId.length === 0) return null;
  const bucket = process.env.R2_BUCKET;
  if (!bucket) return null;
  const key = variantKey(itemId, "w640");
  try {
    const result = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = result.Body;
    if (!body) throw new Error("empty object");
    const bytes = await body.transformToByteArray();
    const compact = await sharp(Buffer.from(bytes), { failOn: "error" })
      .rotate()
      .resize({
        width: BRIEF_REQUEST.visionEdgePx,
        height: BRIEF_REQUEST.visionEdgePx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: BRIEF_REQUEST.visionJpegQuality, chromaSubsampling: "4:2:0" })
      .toBuffer();
    return bytesToDataUrl(compact, "image/jpeg");
  } catch {
    try {
      return await getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: BRIEF_IMAGE_EXPIRES_S,
      });
    } catch {
      return null;
    }
  }
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
export async function runBriefJob(itemId: string): Promise<BriefJob> {
  const key = process.env.DO_INFERENCE_API_KEY;
  const base = process.env.DO_INFERENCE_BASE_URL ?? "https://inference.do-ai.run/v1";
  const model = briefModelId();
  if (!key) {
    const stub = stubJob();
    await persistKitTitleFromBrief(itemId, stub);
    await writeBriefJob(itemId, stub);
    return stub;
  }
  const filled = await filledHexes(itemId).catch(() => new Set<string>());
  try {
    const imageUrl = await w640ImageUrl(itemId);
    if (!imageUrl) throw new Error("brief image missing");
    const parsed = await requestBriefCompletionWithRetry({
      imageUrl,
      keptHexes: [...filled],
      apiKey: key,
      baseUrl: base,
      model,
    });
    const namedColors = parseNamedColors(parsed.namedColors, parsed.namedHexes).filter(
      (c) => !filled.has(c.hex.toLowerCase()),
    );
    const ready = jobPayload({
      status: "ready",
      text: parsed.text,
      subject: parsed.subject,
      namedColors,
      stub: false,
    });
    await persistKitTitleFromBrief(itemId, ready);
    await writeBriefJob(itemId, ready);
    return ready;
  } catch (err) {
    if (err instanceof BriefTimeoutError) {
      console.error("brief timed out", itemId);
    }
    const failed = jobPayload({ status: "failed", text: null, namedColors: [], stub: false });
    await persistKitTitleFromBrief(itemId, failed);
    await writeBriefJob(itemId, failed);
    return failed;
  }
}
