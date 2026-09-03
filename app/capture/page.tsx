import Link from "next/link";
import { capture } from "./actions";
import { CaptureForm } from "./CaptureForm";
import { SavedToast } from "./SavedToast";
import { loadTrayFacets } from "./tray";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "missing-image": "Paste a URL or choose an image first.",
  "bad-url": "That doesn't look like a valid http(s) URL.",
  "blocked-url": "That address is blocked (private/internal networks are not fetchable).",
  "capture-failed": "Capture failed — try again.",
  "bad-image": "That file could not be processed as an image.",
};

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; url?: string; shareToken?: string }>;
}) {
  const params = await searchParams;
  const facets = await loadTrayFacets();

  let savedTitle: string | null = null;
  if (params.saved) {
    const rows = await db.select({ title: items.title }).from(items).where(eq(items.id, params.saved)).limit(1);
    savedTitle = rows[0]?.title ?? null;
  }

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

        <h1 className="mt-6 text-xl font-semibold tracking-tight">Capture</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a link or drop an image. Inzpo detects what it is — tag if you feel like it.
        </p>

        {params.error ? (
          <p className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-red-400">
            {ERRORS[params.error] ?? "Something went wrong."}
          </p>
        ) : null}

        <div className="mt-5">
          <CaptureForm facets={facets} prefilledUrl={params.url ?? ""} shareToken={params.shareToken ?? null} />
        </div>
      </div>
    </main>
  );
}
