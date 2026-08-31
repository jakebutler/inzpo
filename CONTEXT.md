# Inzpo — Domain Language

Glossary only: no implementation details live here. Terms are added or
sharpened the moment they crystallise.

## Terms

**Item** — A single saved piece of design inspiration. Inzpo recognizes six
kinds of Item: URL, screenshot, photo, palette, article, and video.

**Capture** — The act of adding an Item to the library. Capture flows are
designed to be mobile-friendly from day one.

**Facet** — A system-defined categorization dimension with an editable
vocabulary (e.g. Style, Usage, Medium, Format). Facets are the backbone of
structured filtering. The facet set itself is extensible.

**Vocabulary** — The set of allowed values for one Facet. Maintained by the
user: values can be created, renamed, and merged.

**Free tag** — A user-created tag that lives outside any Facet. Free tags are
low-friction glue; Facets carry the structured filtering guarantees.

**Palette** — A set of colors. A Palette may exist as a first-class Item, and
image Items carry extracted dominant colors so they can be found by color.

## Provisional

- **Smart collection** (provisional) — A saved filter query that resolves to a
  live set of Items. Awaiting the filtering-semantics decision.
- **Collection** (provisional) — A manually curated group of Items. Awaiting
  the item-model decision for its exact relationship to Items.
