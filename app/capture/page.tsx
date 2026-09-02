import Link from "next/link";
import { captureImage } from "./actions";
import { ImageDropzone } from "./ImageDropzone";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-xl p-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Wall
          </Link>
          <span className="text-sm text-neutral-500">Capture</span>
        </div>

        <form action={captureImage} className="mt-6">
          <ImageDropzone />
          {params.error === "missing-image" ? (
            <p className="mt-2 text-sm text-red-400">Choose an image first.</p>
          ) : null}
          {params.error === "bad-image" ? (
            <p className="mt-2 text-sm text-red-400">That file could not be processed as an image.</p>
          ) : null}
          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 hover:bg-white min-h-[44px] sticky bottom-4"
          >
            Save
          </button>
        </form>
      </div>
    </main>
  );
}
