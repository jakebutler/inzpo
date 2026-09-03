import Link from "next/link";
import { Pencil, Plus, X } from "lucide-react";
import { db } from "@/lib/db";
import { freeTags } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { getFacetsWithValues } from "@/lib/ontology";
import { listSavedSearches } from "@/lib/saved-searches";
import { MergeForm } from "./MergeForm";
import {
  createFacetValueAction,
  promoteFreeTagAction,
  removeFacetValueAction,
  removeFreeTagAction,
  renameFacetValueAction,
  renameFreeTagAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function VocabPage() {
  const [facets, tags] = await Promise.all([
    getFacetsWithValues(),
    db
      .select({
        id: freeTags.id,
        name: freeTags.name,
        usage: sql<number>`(select count(*)::int from item_free_tags ift where ift.free_tag_id = ${freeTags.id})`,
      })
      .from(freeTags)
      .orderBy(freeTags.name),
  ]);
  const saved = await listSavedSearches();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Wall
          </Link>
          <span className="text-sm text-muted-foreground">Vocabulary manager</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4 pb-16">
        <p className="text-xs text-muted-foreground">
          Six fixed Facets — the user curates vocabularies, not new Facets. Renames and merges propagate into {saved.length} smart
          collection{saved.length === 1 ? "" : "s"} automatically. Remove is only possible while a value is unused.
        </p>

        {facets.map((facet) => (
          <section key={facet.id} className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium">{facet.name}</h2>

            <ul className="mt-2 space-y-1">
              {facet.values.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 rounded px-2 py-1 hover:bg-neutral-900">
                  <span className="min-w-28 text-sm">{v.value}</span>
                  <span className="text-xs text-muted-foreground">{v.usage} item{v.usage === 1 ? "" : "s"}</span>
                  <form action={renameFacetValueAction} className="ml-auto flex items-center gap-1">
                    <input type="hidden" name="facetId" value={facet.id} />
                    <input type="hidden" name="oldValue" value={v.value} />
                    <input
                      type="text"
                      name="newValue"
                      placeholder="rename to…"
                      aria-label={`Rename ${v.value}`}
                      className="w-28 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs"
                    />
                    <button type="submit" aria-label="Rename" className="flex h-9 w-9 items-center justify-center rounded border border-neutral-700 hover:border-neutral-500">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <form action={removeFacetValueAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <button
                      type="submit"
                      disabled={v.usage > 0}
                      title={v.usage > 0 ? `Still used by ${v.usage} items — merge instead` : "Remove (unused)"}
                      className="min-h-[36px] rounded border border-neutral-700 px-2 py-1 text-xs text-red-400 disabled:opacity-30"
                    >
                      remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            <form action={createFacetValueAction} className="mt-2 flex items-center gap-1">
              <input type="hidden" name="facetId" value={facet.id} />
              <input
                type="text"
                name="value"
                placeholder={`＋ new ${facet.name} value`}
                aria-label={`New ${facet.name} value`}
                className="w-44 rounded border border-dashed border-neutral-700 bg-transparent px-2 py-1 text-xs"
              />
              <button type="submit" className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-500">
                create
              </button>
            </form>

            <MergeForm
              facetId={facet.id}
              values={facet.values.map((v) => ({ id: v.id, value: v.value, usage: v.usage }))}
            />
          </section>
        ))}

        <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium">Free tags</h2>
          <ul className="mt-2 space-y-1">
            {tags.map((tag) => (
              <li key={tag.id} className="flex flex-wrap items-center gap-2 rounded px-2 py-1 hover:bg-neutral-900">
                <span className="min-w-28 text-sm">{tag.name}</span>
                <span className="text-xs text-muted-foreground">{tag.usage} item{tag.usage === 1 ? "" : "s"}</span>
                <form action={renameFreeTagAction} className="ml-auto flex items-center gap-1">
                  <input type="hidden" name="id" value={tag.id} />
                  <input
                    type="text"
                    name="newValue"
                    placeholder="rename to…"
                    aria-label={`Rename ${tag.name}`}
                    className="w-28 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs"
                  />
                  <button type="submit" className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-500">
                    ✎
                  </button>
                </form>
                <form action={removeFreeTagAction}>
                  <input type="hidden" name="id" value={tag.id} />
                  <button
                    type="submit"
                    disabled={tag.usage > 0}
                    title={tag.usage > 0 ? `Still used by ${tag.usage} items` : "Remove (unused)"}
                    className="min-h-[36px] rounded border border-neutral-700 px-2 py-1 text-xs text-red-400 disabled:opacity-30"
                  >
                    remove
                  </button>
                </form>
                <form action={promoteFreeTagAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={tag.id} />
                  <select name="facetId" aria-label={`Promote ${tag.name} to facet`} className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs">
                    {facets.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="flex min-h-[36px] items-center rounded border border-sky-500/50 px-2 py-1 text-xs text-sky-300">
                    promote
                  </button>
                </form>
              </li>
            ))}
            {tags.length === 0 ? <li className="text-xs text-muted-foreground">No free tags yet.</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
