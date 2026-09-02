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
              <Link href={`/items/${item.id}`} className="block">
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
                <figcaption className="px-3 py-2">
                  <div className="text-xs">
                    <span className="uppercase tracking-wide text-neutral-500">{item.kind}</span>
                    <span className="ml-2 text-neutral-300">{item.title ?? "Untitled"}</span>
                  </div>
                  {item.hexColors.length > 0 ? (
                    <div className="mt-1.5 flex gap-1">
                      {item.hexColors.slice(0, 6).map((hex, i) => (
                        <span
                          key={`${item.id}-${hex}-${i}`}
                          className="inline-block h-3 w-3 rounded-full border border-neutral-700"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {item.facetTags.length > 0 || item.freeTags.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.facetTags.map((t) => (
                        <span
                          key={`${t.facet}:${t.value}`}
                          className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400"
                        >
                          {t.value}
                        </span>
                      ))}
                      {item.freeTags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[10px] text-sky-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </figcaption>
              </Link>
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}
