import { eq } from "drizzle-orm";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, briefKey } from "@/lib/r2";
import { assertItemOwned } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import { itemColors } from "@/lib/db/schema";
import { BRIEF_PROMPT } from "@/lib/brief-prompt";
import { parseNamedColors, type NamedColor } from "@/lib/brief-copy";

export type BriefStatus = "pending" | "ready" | "failed";

export interface BriefJob {
  status: BriefStatus;
  text: string | null;
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

function stubJob(filled: Set<string>): BriefJob {
  const dropped: NamedColor[] = [];
  const candidate = { hex: "#e8c36a", label: "yellow door" };
  if (!filled.has(candidate.hex.toLowerCase())) dropped.push(candidate);
  return jobPayload({
    status: "ready",
    text: "[stub — no DO_INFERENCE_API_KEY] Warm stone against shade. Save is safe; the brief is a stub.",
    namedColors: dropped,
    stub: true,
  });
}

/** Runs off the request. Without DO_INFERENCE_API_KEY the job stubs a labeled brief so Save stays unblocked. */
export async function runBriefJob(itemId: string): Promise<BriefJob> {
  const key = process.env.DO_INFERENCE_API_KEY;
  const base = process.env.DO_INFERENCE_BASE_URL ?? "https://inference.do-ai.run/v1";
  const model = process.env.BRIEF_MODEL ?? process.env.BRIEF_MODEL_URL ?? "openai/glm-5.3-flash";
  const filled = await filledHexes(itemId).catch(() => new Set<string>());
  if (!key) {
    const stub = stubJob(filled);
    await writeBriefJob(itemId, stub);
    return stub;
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: BRIEF_PROMPT },
          { role: "user", content: `Palette hexes already kept: ${[...filled].join(", ") || "(none)"}.` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error("brief failed");
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    const parsed = content ? (JSON.parse(content) as { text?: string; namedColors?: unknown; namedHexes?: string[] }) : {};
    const namedColors = parseNamedColors(parsed.namedColors, parsed.namedHexes ?? []).filter(
      (c) => !filled.has(c.hex.toLowerCase()),
    );
    const ready = jobPayload({
      status: "ready",
      text: typeof parsed.text === "string" ? parsed.text : null,
      namedColors,
      stub: false,
    });
    await writeBriefJob(itemId, ready);
    return ready;
  } catch {
    const failed = jobPayload({ status: "failed", text: null, namedColors: [], stub: false });
    await writeBriefJob(itemId, failed);
    return failed;
  }
}
