import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/owner";
import { readBriefJob, runBriefJob } from "@/lib/brief";
import { persistKitTitleFromBrief } from "@/lib/kit-title";
import { assertItemOwned } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  const job = await readBriefJob(id);
  if (job?.status === "ready") {
    const title = await persistKitTitleFromBrief(id, job);
    if (title) {
      revalidatePath(`/items/${id}`);
      revalidatePath("/");
    }
  }
  return NextResponse.json(
    job ?? { status: "pending", text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 },
  );
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  const job = await runBriefJob(id);
  if (job.status === "ready") {
    revalidatePath(`/items/${id}`);
    revalidatePath("/");
  }
  return NextResponse.json(job);
}
