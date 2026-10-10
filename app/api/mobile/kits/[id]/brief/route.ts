import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { BriefJob } from "@inzpo/shared";
import { requireMobileOwner } from "@/lib/auth/bearer";
import { assertItemOwned } from "@/lib/auth/owner";
import { readBriefJob, runBriefJob } from "@/lib/brief";
import { persistKitTitleFromBrief } from "@/lib/kit-title";
import { mobileServerError, pendingBrief, type MobileKitContext } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await assertItemOwned(auth.ownerId, id);
    const job = await readBriefJob(id);
    if (job?.status === "ready") {
      const title = await persistKitTitleFromBrief(id, job);
      if (title) {
        revalidatePath(`/items/${id}`);
        revalidatePath("/");
      }
    }
    return NextResponse.json<BriefJob>(job ?? pendingBrief());
  } catch (error) {
    return mobileServerError(error);
  }
}

export async function POST(request: Request, { params }: MobileKitContext) {
  const auth = await requireMobileOwner(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await assertItemOwned(auth.ownerId, id);
    const job = await runBriefJob(id);
    if (job.status === "ready") {
      revalidatePath(`/items/${id}`);
      revalidatePath("/");
    }
    return NextResponse.json<BriefJob>(job);
  } catch (error) {
    return mobileServerError(error);
  }
}
