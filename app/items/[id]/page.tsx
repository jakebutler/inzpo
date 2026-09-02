import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemDetail } from "@/lib/items";
import { getItemTags } from "@/lib/ontology";
import { DeleteButton } from "../DeleteButton";

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
          <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs uppercase tracking-wide text-neutral-400">
            {KIND_LABEL[item.kind] ?? item.kind}
          </span>
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
