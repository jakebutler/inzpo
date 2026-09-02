import { getWallItems, countWallItems } from "@/lib/items";
import { getFacetsWithValues } from "@/lib/ontology";
import { db } from "@/lib/db";
import { freeTags } from "@/lib/db/schema";
import { parseFilterParam, serializeFilter } from "@/lib/filter";
import { COLOR_FAMILIES } from "@/lib/colors";
import { listSavedSearches } from "@/lib/saved-searches";
import { listCollections, collectionExists } from "@/lib/collections";
import { FilterBar } from "./components/FilterBar";
import { SavedPopover } from "./components/SavedPopover";
import { LogoutButton } from "./components/LogoutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Wall({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; c?: string }>;
}) {
  const params = await searchParams;
  const state = parseFilterParam(params.f ?? null);
  const collectionId = typeof params.c === "string" && (await collectionExists(params.c)) ? params.c : null;

  const [wallItems, count, facets, tags, saved, collections] = await Promise.all([
    getWallItems(state, collectionId),
    countWallItems(state, collectionId),
    getFacetsWithValues(),
    db.select({ name: freeTags.name }).from(freeTags).orderBy(freeTags.name),
    listSavedSearches(),
    listCollections(),
  ]);

  const savedSlot = (
    <div className="flex items-center gap-2">
      <SavedPopover
        state={state}
        entries={saved.map((s) => ({ id: s.id, name: s.name, f: serializeFilter(s.state) }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name, count: c.count }))}
      />
      <LogoutButton />
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <FilterBar
        state={state}
        facets={facets.map((f) => ({ id: f.id, name: f.name, values: f.values.map((v) => v.value) }))}
        families={[...COLOR_FAMILIES]}
        freeTags={tags.map((t) => t.name)}
        matchCount={count}
        savedSlot={savedSlot}
      />

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-3">
        <span className="text-xs text-neutral-500">
          {count} item{count === 1 ? "" : "s"}
          {collectionId ? (
            <>
              {" "}
              in{" "}
              <Link href="/" className="text-neutral-300 underline decoration-neutral-600">
                {collections.find((c) => c.id === collectionId)?.name ?? "collection"}
              </Link>{" "}
              — <Link href="/">clear scope</Link>
            </>
          ) : null}
        </span>
        <Link href="/capture" className="text-xs text-neutral-400 hover:text-neutral-200">
          + Capture
        </Link>
      </div>

      {wallItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
          <p className="text-neutral-300">Nothing matches.</p>
          <p className="text-sm text-neutral-500">Adjust the filters, or capture something new.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-4 columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
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
                  <div className="flex h-32 items-center justify-center px-3 text-center text-neutral-500">
                    {item.title ?? "Untitled"}
                  </div>
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
                        <span key={t} className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[10px] text-sky-300">
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
