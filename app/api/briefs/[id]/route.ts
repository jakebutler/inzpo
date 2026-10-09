import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireOwnerId } from "@/lib/auth/owner";
import { readBriefJob, runBriefJob } from "@/lib/brief";
import { persistKitTitleFromBrief } from "@/lib/kit-title";
import { assertItemOwned } from "@/lib/auth/owner";
import { isRecentPendingBrief } from "@/lib/brief-state";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  const job = await readBriefJob(id);
  let title: string | null = null;
  if (job && job.status !== "pending") {
    title = await persistKitTitleFromBrief(id, job);
    if (title) {
      revalidatePath(`/items/${id}`);
      revalidatePath("/");
    }
  }
  return NextResponse.json(
    { ...(job ?? { status: "pending", text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 }), title },
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  // Only the explicit BriefSlot retry may replace the stored brief. A plain
  // POST may only finish a job left pending (the after() run was lost); it
  // never touches a completed brief.
  let job = request.nextUrl.searchParams.get("retry") === "1"
    ? await runBriefJob(id, { retry: true })
    : await readBriefJob(id);
  if (job?.status === "pending" && !isRecentPendingBrief(job)) {
    job = await runBriefJob(id);
  }
  let title: string | null = null;
  if (job && job.status !== "pending") {
    title = await persistKitTitleFromBrief(id, job);
    revalidatePath(`/items/${id}`);
    revalidatePath("/");
  }
  return NextResponse.json({
    ...(job ?? { status: "pending", text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 }),
    title,
  });
}
