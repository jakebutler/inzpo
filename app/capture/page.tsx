import Link from "next/link";
import { CaptureForm } from "./CaptureForm";
import { getLatestKit } from "@/lib/items";
import { MascotStage } from "@/app/components/MascotStage";
import { KitCard } from "@/app/components/KitCard";
import { SAMPLE_KIT } from "@/lib/sample-kit";
import { requireOwnerId } from "@/lib/auth/owner";
import { LINKS_UNSUPPORTED_ERROR, LINKS_UNSUPPORTED_MESSAGE, isLinksUnsupportedRequest } from "@/lib/links";
import { BRIEF_MAX_DURATION_S } from "@/lib/brief-request";

export const dynamic = "force-dynamic";
export const maxDuration = BRIEF_MAX_DURATION_S;

const ERRORS: Record<string, string> = {
  "missing-image": "Choose a photo first.",
  "capture-failed": "Capture failed — try again.",
  "bad-image": "That file could not be processed as an image.",
  [LINKS_UNSUPPORTED_ERROR]: LINKS_UNSUPPORTED_MESSAGE,
};

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; url?: string; shareToken?: string }>;
}) {
  const ownerId = await requireOwnerId();
  const params = await searchParams;
  const unreadable = params.error === "bad-image";
  const linksBlocked = isLinksUnsupportedRequest(params);
  const last = await getLatestKit(ownerId);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-4 pb-36 pt-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-base">
            ← Wall
          </Link>
        </div>

        <h1 className="font-heading mt-8 max-w-[14ch] text-left text-[40px] leading-[1.15] tracking-tight">
          Steal the colors off anything
        </h1>

        {linksBlocked ? (
          <p role="status" className="mt-3 text-base">
            {LINKS_UNSUPPORTED_MESSAGE}
          </p>
        ) : unreadable ? (
          <div className="mt-4">
            <MascotStage moment="error-unreadable" snapReady />
          </div>
        ) : params.error ? (
          <p role="alert" className="mt-3 text-base text-primary">
            {ERRORS[params.error] ?? "Something went wrong."}
          </p>
        ) : null}

        <div className="mt-8">
          {last ? (
            <KitCard
              title={last.title ?? "Last kit"}
              imageSrc={last.displayKey ? `/media/${last.displayKey}` : null}
              hexes={last.hexColors}
            />
          ) : (
            <KitCard title={SAMPLE_KIT.title} imageSrc={SAMPLE_KIT.imageSrc} hexes={[...SAMPLE_KIT.hexes]} />
          )}
        </div>

        <div className="mt-5">
          <CaptureForm shareToken={params.shareToken ?? null} firstOpen={!params.error} />
        </div>
      </div>
    </main>
  );
}
