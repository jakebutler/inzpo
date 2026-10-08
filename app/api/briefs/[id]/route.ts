import { NextRequest, NextResponse } from "next/server";
import { requireOwnerId } from "@/lib/auth/owner";
import { readBriefJob, runBriefJob } from "@/lib/brief";
import { assertItemOwned } from "@/lib/auth/owner";
import { BRIEF_MAX_DURATION_S } from "@/lib/brief-request";

export const dynamic = "force-dynamic";
export const maxDuration = BRIEF_MAX_DURATION_S;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  const job = await readBriefJob(id);
  return NextResponse.json(
    job ?? { status: "pending", text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 },
  );
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwnerId();
  const { id } = await params;
  await assertItemOwned(ownerId, id);
  const job = await runBriefJob(id);
  return NextResponse.json(job);
}
