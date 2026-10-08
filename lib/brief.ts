import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, briefKey } from "@/lib/r2";
import { assertItemOwned } from "@/lib/auth/owner";

export type BriefStatus = "pending" | "ready" | "failed";

export interface BriefJob {
  status: BriefStatus;
  text: string | null;
  namedHexes: string[];
  updatedAt: number;
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
    const parsed = JSON.parse(raw) as BriefJob;
    if (parsed.status !== "pending" && parsed.status !== "ready" && parsed.status !== "failed") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function startBriefJob(ownerId: string, itemId: string): Promise<void> {
  await assertItemOwned(ownerId, itemId);
  await writeBriefJob(itemId, { status: "pending", text: null, namedHexes: [], updatedAt: Date.now() });
}

/** Runs off the request. Without a brief model URL the job fails closed so Save stays unblocked. */
export async function runBriefJob(itemId: string): Promise<BriefJob> {
  const url = process.env.BRIEF_MODEL_URL;
  if (!url) {
    const failed: BriefJob = { status: "failed", text: null, namedHexes: [], updatedAt: Date.now() };
    await writeBriefJob(itemId, failed);
    return failed;
  }
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    if (!res.ok) throw new Error("brief failed");
    const body = (await res.json()) as { text?: string; namedHexes?: string[] };
    const ready: BriefJob = {
      status: "ready",
      text: typeof body.text === "string" ? body.text : null,
      namedHexes: Array.isArray(body.namedHexes) ? body.namedHexes.filter((h) => typeof h === "string") : [],
      updatedAt: Date.now(),
    };
    await writeBriefJob(itemId, ready);
    return ready;
  } catch {
    const failed: BriefJob = { status: "failed", text: null, namedHexes: [], updatedAt: Date.now() };
    await writeBriefJob(itemId, failed);
    return failed;
  }
}
