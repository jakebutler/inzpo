import Link from "next/link";
import { CaptureForm } from "./CaptureForm";
import { SavedToast } from "./SavedToast";
import { getItemDetail } from "@/lib/items";
import { kitFromColors } from "@/lib/mascot";
import { MascotStage } from "@/app/components/MascotStage";
import { requireOwnerId } from "@/lib/auth/owner";
import { LINKS_UNSUPPORTED_ERROR, LINKS_UNSUPPORTED_MESSAGE, isLinksUnsupportedRequest } from "@/lib/links";

export const dynamic = "force-dynamic";

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
  let savedTitle: string | null = null;
  let savedKit = kitFromColors([]);
  if (params.saved) {
    const saved = await getItemDetail(ownerId, params.saved);
    savedTitle = saved?.title ?? null;
    if (saved) savedKit = kitFromColors(saved.colors);
  }
  const unreadable = params.error === "bad-image";
  const linksBlocked = isLinksUnsupportedRequest(params);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl p-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Wall
          </Link>
          <span className="text-sm text-muted-foreground">Capture</span>
        </div>

        {params.saved ? <SavedToast itemId={params.saved} title={savedTitle} /> : null}

        <h1 className="mt-6 text-xl font-semibold tracking-tight">Snap</h1>
        <p className="mt-1 text-sm text-muted-foreground">Steal the colors off anything.</p>

        {params.saved ? (
          <div className="mt-4">
            <MascotStage moment="success" kit={savedKit} snapReady />
          </div>
        ) : null}

        {linksBlocked ? (
          <p role="status" className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            {LINKS_UNSUPPORTED_MESSAGE}
          </p>
        ) : unreadable ? (
          <div className="mt-4">
            <MascotStage moment="error-unreadable" snapReady />
          </div>
        ) : params.error ? (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERRORS[params.error] ?? "Something went wrong."}
          </p>
        ) : null}

        <div className="mt-5">
          <CaptureForm shareToken={params.shareToken ?? null} firstOpen={!params.saved && !params.error} />
        </div>
      </div>
    </main>
  );
}
