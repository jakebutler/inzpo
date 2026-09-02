import Link from "next/link";
import { capture } from "./actions";
import { ImageDropzone } from "./ImageDropzone";
import { TagTray } from "./TagTray";
import { loadTrayFacets } from "./tray";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const facets = await loadTrayFacets();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-xl p-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Wall
          </Link>
          <span className="text-sm text-neutral-500">Capture</span>
        </div>

        <form action={capture} className="mt-6 pb-4">
          <input
            type="url"
            name="url"
            inputMode="url"
            placeholder="Paste a link…"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-neutral-500 min-h-[44px]"
          />
          <p className="mt-2 text-center text-xs text-neutral-500">— or —</p>
          <div className="mt-2">
            <ImageDropzone />
          </div>
          {params.error ? (
            <p className="mt-2 text-sm text-red-400">{ERRORS[params.error] ?? "Something went wrong."}</p>
          ) : null}

          <div className="mt-6">
            <TagTray facets={facets} />
          </div>

          <button
            type="submit"
            className="mt-8 w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 hover:bg-white min-h-[44px] sticky bottom-4 shadow-lg shadow-black/40"
          >
            Save
          </button>
        </form>
      </div>
    </main>
  );
}
