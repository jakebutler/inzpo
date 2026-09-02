import Link from "next/link";
import { getWallItems } from "@/lib/items";
import { LogoutButton } from "./components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Wall() {
  const wallItems = await getWallItems();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">Inzpo</span>
          <div className="flex items-center gap-4">
            <Link
              href="/capture"
              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white min-h-[36px] flex items-center"
            >
              + Capture
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>

      {wallItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
          <p className="text-neutral-300">The wall is empty.</p>
          <p className="text-sm text-neutral-500">Capture a photo to place the first brick.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-6 columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
          {wallItems.map((item) => (
            <figure key={item.id} className="break-inside-avoid overflow-hidden rounded-xl bg-neutral-900">
              {item.displayKey ? (
                <img
                  src={`/media/${item.displayKey}`}
                  alt={item.title ?? "Item"}
                  loading="lazy"
                  decoding="async"
                  style={item.aspect ? { aspectRatio: String(item.aspect) } : undefined}
                  className="w-full object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center text-neutral-600">no media</div>
              )}
              <figcaption className="px-3 py-2 text-xs text-neutral-400">
                <span className="uppercase tracking-wide text-neutral-500">{item.kind}</span>
                <span className="ml-2">{item.title ?? "Untitled"}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}
