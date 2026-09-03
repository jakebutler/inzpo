import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemDetail } from "@/lib/items";
import { getItemTags } from "@/lib/ontology";
import { getFacetsWithValues } from "@/lib/ontology";
import { updateItem } from "./actions";
import { PaletteColorEditor } from "./PaletteColorEditor";
import { TagTray } from "@/app/capture/TagTray";
import { loadTrayFacets } from "@/app/capture/tray";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemDetail(id);
  if (!item) notFound();
  const [tags, facets, trayFacets] = await Promise.all([getItemTags(id), getFacetsWithValues(), loadTrayFacets()]);

  const initialFacetValues: Record<string, string[]> = {};
  for (const t of tags.facetTags) {
    const facet = facets.find((f) => f.name === t.facet);
    if (facet) {
      initialFacetValues[facet.id] = [...(initialFacetValues[facet.id] ?? []), t.value];
    }
  }

  const substanceLocked = item.kind === "article" || item.kind === "palette";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-xl p-6">
        <div className="flex items-center justify-between">
          <Link href={`/items/${id}`} className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Cancel
          </Link>
          <Link href="/vocab" className="text-sm text-neutral-400 hover:text-neutral-200">
            Manage vocabulary ›
          </Link>
        </div>

        <form action={updateItem} className="mt-6 pb-4">
          <input type="hidden" name="itemId" value={id} />
          <label className="block text-xs uppercase tracking-wide text-neutral-500" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            name="title"
            defaultValue={item.title ?? ""}
            placeholder="Untitled"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm min-h-[36px] outline-none focus:border-neutral-500"
          />

          <label className="mt-4 block text-xs uppercase tracking-wide text-neutral-500" htmlFor="note">
            Note
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            defaultValue={item.note ?? ""}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />

          {item.source ? (
            <fieldset className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <legend className="px-1 text-xs uppercase tracking-wide text-neutral-500">Source (the copy)</legend>
              <label className="block text-xs text-neutral-500" htmlFor="sourceUrl">
                URL
              </label>
              <input
                id="sourceUrl"
                type="url"
                name="sourceUrl"
                defaultValue={item.source.url}
                className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-neutral-500"
              />
              <label className="mt-2 block text-xs text-neutral-500" htmlFor="sourceTitle">
                Title
              </label>
              <input
                id="sourceTitle"
                type="text"
                name="sourceTitle"
                defaultValue={item.source.title ?? ""}
                className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-neutral-500"
              />
              <label className="mt-2 block text-xs text-neutral-500" htmlFor="sourceDescription">
                Description
              </label>
              <textarea
                id="sourceDescription"
                name="sourceDescription"
                rows={2}
                defaultValue={item.source.description ?? ""}
                className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs outline-none focus:border-neutral-500"
              />
            </fieldset>
          ) : null}

          <div className="mt-4">
            <TagTray facets={trayFacets} initial={{ facetValues: initialFacetValues, freeTags: tags.freeTags }} />
          </div>

          {item.kind === "palette" ? (
            <div className="mt-4">
              <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Palette colors</h2>
              <PaletteColorEditor itemId={item.id} initialColors={item.colors.map((c) => c.hex)} />
            </div>
          ) : null}

          {substanceLocked && item.kind !== "palette" ? (
            <p className="mt-4 text-xs text-neutral-500">
              {item.kind === "article"
                ? "The archived copy is capture-time substance — it is not editable."
                : "Palette colors are edited with the color editor below."}
            </p>
          ) : null}

          <div className="mt-6 flex gap-2 sticky bottom-4">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 hover:bg-white min-h-[44px] shadow-lg shadow-black/40"
            >
              Done
            </button>
            <Link
              href={`/items/${id}`}
              className="flex items-center justify-center rounded-lg border border-neutral-700 px-4 py-3 text-base min-h-[44px]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
