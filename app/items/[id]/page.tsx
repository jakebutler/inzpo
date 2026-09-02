import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemDetail, getArticleHtml } from "@/lib/items";
import { getItemTags } from "@/lib/ontology";
import { getItemCollections, listCollectionOptions } from "@/lib/item-collections";
import { DeleteButton } from "../DeleteButton";
import { addToCollectionAction, removeFromCollectionAction } from "@/app/actions/collections";
import { saveExtractedAsPaletteAction } from "@/app/actions/palettes";
import { getOrigin, getDerivedItems } from "@/lib/palettes";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  url: "URL",
  screenshot: "Screenshot",
  photo: "Photo",
  palette: "Palette",
  article: "Article",
  video: "Video",
};

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemDetail(id);
  if (!item) notFound();
  const tags = await getItemTags(id);
  const [memberships, options, articleHtml] = await Promise.all([
    getItemCollections(id),
    listCollectionOptions(),
    item.hasArticle ? getArticleHtml(id) : Promise.resolve(null),
  ]);
  const joinable = options.filter((o) => !memberships.some((m) => m.id === o.id));
  const [originId, derived] = await Promise.all([getOrigin(id), getDerivedItems(id)]);

  const embedSrc = item.oembedHtml?.match(/src=["']([^"']+)["']/i)?.[1] ?? null;

  const facetGroups = new Map<string, string[]>();
  for (const t of tags.facetTags) {
    facetGroups.set(t.facet, [...(facetGroups.get(t.facet) ?? []), t.value]);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Wall
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/items/${item.id}/edit`} className="text-sm text-neutral-300 hover:text-white">
              ✎ Edit
            </Link>
            <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs uppercase tracking-wide text-neutral-400">
              {KIND_LABEL[item.kind] ?? item.kind}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4">
        {item.media?.displayKey ? (
          <img
            src={`/media/${item.media.displayKey}`}
            alt={item.title ?? "Item"}
            className="w-full rounded-xl bg-neutral-900"
          />
        ) : null}

        <div className="mt-4">
          <h1 className="text-xl font-semibold tracking-tight">{item.title ?? "Untitled"}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Captured {item.createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {item.note ? <p className="mt-3 whitespace-pre-wrap text-neutral-300">{item.note}</p> : null}

        {item.source ? (
          <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">Source</h2>
            <a
              href={item.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-sm text-sky-400 hover:underline"
            >
              {item.source.url}
            </a>
            {item.source.title ? <p className="mt-1 text-sm">{item.source.title}</p> : null}
            {item.source.description ? (
              <p className="mt-1 text-sm text-neutral-400">{item.source.description}</p>
            ) : null}
          </section>
        ) : null}

        {embedSrc ? (
          <section className="mt-4 overflow-hidden rounded-xl border border-neutral-800">
            <iframe
              src={embedSrc}
              title={item.title ?? "Video"}
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="aspect-video w-full"
            />
          </section>
        ) : null}

        {articleHtml ? (
          <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">Archived copy</h2>
            <div
              className="article-reader mt-3 max-w-prose text-[15px] leading-relaxed text-neutral-200 [&_a]:text-sky-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-600 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-neutral-800 [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-neutral-800 [&_pre]:p-3 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: articleHtml }}
            />
          </section>
        ) : null}

        {item.colors.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">Colors</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.colors.map((c) => (
                <span
                  key={`${c.hex}-${c.position}`}
                  title={`${c.hex} · ${c.family}`}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 py-1 pl-1 pr-3"
                >
                  <span className="inline-block h-6 w-6 rounded-full border border-neutral-700" style={{ backgroundColor: c.hex }} />
                  <span className="text-xs text-neutral-400">
                    {c.hex} · {c.family}
                  </span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {facetGroups.size > 0 || tags.freeTags.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">Tags</h2>
            <div className="mt-2 space-y-3">
              {[...facetGroups.entries()].map(([facet, values]) => (
                <div key={facet} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs uppercase tracking-wide text-neutral-500 w-24">{facet}</span>
                  {values.map((v) => (
                    <span key={v} className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm">
                      {v}
                    </span>
                  ))}
                </div>
              ))}
              {tags.freeTags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs uppercase tracking-wide text-neutral-500 w-24">Free</span>
                  {tags.freeTags.map((t) => (
                    <span key={t} className="rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-300">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {item.colors.length > 0 && (item.kind === "screenshot" || item.kind === "photo") ? (
          <form action={saveExtractedAsPaletteAction} className="mt-3">
            <input type="hidden" name="itemId" value={item.id} />
            <button type="submit" className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 min-h-[32px]">
              Save extracted colors as a palette
            </button>
          </form>
        ) : null}

        {originId || derived.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">Origin</h2>
            <div className="mt-2 space-y-1 text-sm">
              {originId ? (
                <p className="text-neutral-300">
                  Derived from{" "}
                  <Link href={`/items/${originId}`} className="text-sky-400 hover:underline">
                    {originId === item.id ? "this item" : "its source item"}
                  </Link>
                </p>
              ) : null}
              {derived.length > 0 ? (
                <p className="text-neutral-400">
                  {derived.length === 1 ? "A palette is derived from this item: " : `${derived.length} derived items: `}
                  {derived.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 ? ", " : ""}
                      <Link href={`/items/${d.id}`} className="text-sky-400 hover:underline">
                        {d.kind}
                      </Link>
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">Collections</h2>
          {memberships.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {memberships.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900 py-1 pl-3 pr-1 text-sm">
                  {m.name}
                  <form action={removeFromCollectionAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="collectionId" value={m.id} />
                    <button type="submit" className="rounded-full px-2 text-xs text-neutral-500 hover:text-red-400" aria-label={`Remove from ${m.name}`}>
                      ✕
                    </button>
                  </form>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-neutral-600">Not in any collection yet.</p>
          )}
          <form action={addToCollectionAction} className="mt-2 flex flex-wrap items-center gap-1.5">
            <input type="hidden" name="itemId" value={item.id} />
            {joinable.length > 0 ? (
              <select
                name="collectionId"
                aria-label="Add to collection"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm min-h-[36px]"
              >
                <option value="">Add to collection…</option>
                {joinable.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              name="newName"
              placeholder="＋ new collection"
              aria-label="New collection name"
              className="w-40 rounded-full border border-dashed border-neutral-700 bg-transparent px-3 py-1.5 text-sm min-h-[36px] outline-none focus:border-neutral-500"
            />
            <button type="submit" className="rounded-full border border-neutral-700 px-3 py-1.5 text-sm min-h-[36px] hover:border-neutral-500">
              Add
            </button>
          </form>
        </section>

        <section className="mt-8 flex items-center justify-between border-t border-neutral-800 pt-4 pb-8">
          {item.source ? (
            <a
              href={item.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-300 hover:text-white min-h-[36px] flex items-center"
            >
              Open source ↗
            </a>
          ) : (
            <span />
          )}
          <DeleteButton itemId={item.id} title={item.title} />
        </section>
      </div>
    </main>
  );
}
