import { getWallItems, countWallItems } from "@/lib/items";
import { getFacetsWithValues } from "@/lib/ontology";
import { db } from "@/lib/db";
import { freeTags } from "@/lib/db/schema";
import { parseFilterParam, serializeFilter } from "@/lib/filter";
import { COLOR_FAMILIES } from "@/lib/colors";
import { listSavedSearches } from "@/lib/saved-searches";
import { listCollections, collectionExists } from "@/lib/collections";
import { FilterBar } from "./components/FilterBar";
import { WallGrid } from "./components/WallGrid";
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
        <div className="flex items-center gap-4">
          <Link href="/vocab" className="text-xs text-neutral-400 hover:text-neutral-200">
            Vocabulary
          </Link>
          <Link href="/capture" className="text-xs text-neutral-400 hover:text-neutral-200">
            + Capture
          </Link>
        </div>
      </div>

      <WallGrid
        items={wallItems.map((w) => ({
          id: w.id,
          kind: w.kind,
          title: w.title,
          displayKey: w.displayKey,
          aspect: w.aspect,
          hexColors: w.hexColors,
          facetTags: w.facetTags,
          freeTags: w.freeTags,
          sourceUrl: w.sourceUrl,
        }))}
        state={state}
        totalCount={count}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        facetOptions={facets.map((f) => ({ id: f.id, name: f.name }))}
      />
    </main>
  );
}
