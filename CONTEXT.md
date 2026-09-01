# Inzpo — Domain Language

Glossary only: no implementation details live here. Terms are added or
sharpened the moment they crystallise.

## Terms

**Owner** — The one person Inzpo belongs to: the library's only reader and
writer. Auth exists to let the Owner in and keep everyone else out.

**Item** — A single saved piece of design inspiration. Inzpo recognizes six
kinds of Item: URL, screenshot, photo, palette, article, and video. An Item
is one captured thing: its kind is fixed when it is captured and never
changes afterward. Among the linked kinds, the kind records what the
substance is: an article is written content, a video is a video, and a URL
is anything else worth visiting — a page whose visual or UX is the point.

**Capture** — The act of adding an Item to the library. Capture flows are
designed to be mobile-friendly from day one.

**Capture surface** — The single screen where Capture happens. It re-arms
after each Save — fully cleared, nothing carried over — so a run of
Captures never leaves it. A transient confirmation offers a jump to the
captured Item.

**Share target** — Inzpo's entry in the operating system's share sheet: a
front door to Capture for a URL or image shared from another app. It opens
the same capture surface, pre-filled — no separate flow, no new kinds.
Exists only where the platform supports it; elsewhere Capture is reached
in-app.

**Duplicate notice** — The capture surface's heads-up when an Item already exists
for the same source address: it names the existing Item and offers a jump to
it, but never blocks the Save. It watches URL-linked kinds only, and addresses
compare normalized — the same page reached through differently dressed links
counts as the same.

**Source** — The outside address a URL, article, or video Item points at.
What Inzpo knows about the source — title, description, poster image — is
copied into the Item at capture; the Item shows and edits the copy, and
never depends on the source staying reachable or unchanged. The one
live-render exception: a platform video's playable embed plays from the
source while the source lasts; the copied poster and link are what survive.

**Archived copy** — The readable text of an article, copied from its
source at capture. It is an Article Item's substance: the copy is what
gets read, so the Item never depends on the source staying reachable or
unchanged.

**Media asset** — An image Inzpo stores for the user, along with the
smaller display copies made from it. An Item carries at most one media
asset as its **primary** — the substance of the Item itself (a screenshot
or photo). A linked Item instead carries a **preview**: a stand-in image
for a substance that lives outside Inzpo.

**Origin** — The Item a derived Item came from: the only link between
Items in v1. A Palette saved from an image's extracted colors carries an
Origin pointing at that image. Shown on both Items; deleting the Origin
Item clears the link, and the derived Item keeps its own substance.

**Facet** — A categorization dimension with an editable vocabulary, and the
backbone of structured filtering. Inzpo ships six Facets: **Style** (the
design language), **Usage** (the intended use), **Medium** (the surface the
design lives on), **Format** (the artifact's shape), **Mood** (the emotional
read), and **Complexity** (the visual information density). The facet set is
fixed in v1 — the user curates vocabularies, not new Facets. An Item can
carry any number of values for a Facet. Item kind and Color sit alongside
Facets as filter dimensions, but are not Facets.

**Vocabulary** — The set of allowed values for one Facet. Ships seeded with a
small curated starter set, then maintained by the user: values can be created
(also on the fly while capturing), renamed, and merged. Values are shared —
renaming or merging a value updates every Item that carries it — and a value
can be removed only while no Item uses it.

**Free tag** — A user-created tag that lives outside any Facet. Free tags are
low-friction glue; Facets carry the structured filtering guarantees. A Free
tag shares the Vocabulary lifecycle (create, rename, merge) but lives in its
own namespace: a Free tag and a Facet value may share a name without being
the same thing. Free tags and Facets appear together in one filter bar. A
Free tag can be promoted into a Facet value: every Item carrying the tag
gains the value, and the tag dissolves.

**Palette** — A set of colors. A Palette may exist as a first-class Item:
user-owned, editable, ordered. Image Items instead carry **extracted
colors**: derived automatically from the image, regenerable, never
hand-edited. Saving extracted colors as a palette creates a new first-class
Item that copies the values — related to the image it came from, but no
longer dependent on it.

**Color** — A filter dimension alongside the Facets, but not a Facet: it
ranges over every color an Item carries — an image's extracted colors or a
Palette's color list. Carried colors map deterministically onto the
**color taxonomy**, the fixed set of color families the swatch picker
offers: red, orange, yellow, cream/beige, brown, gold, green, teal, blue,
purple, pink, black, white, gray. The taxonomy has no user-maintained
vocabulary. An Item matches a family when any color it carries maps to it,
and swatch selections take the same include, exclude, or ignore stance as
facet values.

**Wall** — The scrollable wall of Item cards: the browse surface where the
library is seen at a glance and narrowed down. Every kind appears on the
Wall under one card shape; what varies is the substance the card shows. The
Wall is not a group — it is whatever the Filter bar currently resolves to.

**Filter bar** — The one bar that scopes the Wall: text search, facet
selections, free tags, color swatches, and item kind, acting together —
any-of within a dimension, AND across dimensions, each selection taking an
include, exclude, or ignore stance. Saved in its entirety by a Smart
collection (which adds a sort of its own). A Collection is a scope the bar
can operate within, not part of the bar.

**Selection** — A Wall mode for acting on many Items at once: taps become
toggles, and bulk actions — tag assign/remove, collection add/remove, delete —
apply to the selected Items. Select all reaches the whole filter-bar
resolution, not just the rendered cards. A Collection gains bulk-added Items
at its end, in the Wall's current order; only bulk delete asks for
confirmation.

**Item detail view** — The screen where an Item is seen whole: its
substance, its copied Source, its colors, its Facet values and free tags,
its Origin, and its Collection memberships, with tagging and grouping
actions at hand. The destination of the capture confirmation's View-item
action.

**Collection** — A manually curated, ordered group of Items. An Item may
live in any number of Collections. A Collection carries no Facets of its
own — Facets live on Items. Deleting a Collection never deletes its Items.

**Smart collection** — A saved filter query that resolves to a live set of
Items. It stores the complete filter-bar state — facet selections, free
tags, color swatches, item kind, text query — plus a sort, and the query
runs fresh, so membership follows the Items. Membership is ordered only by
that sort, never by hand; a hand-ordered group is a Collection.

**Text search** — The one query box in the filter bar, combined with every
other dimension. Its reach: titles, notes, facet values, free tags, copied
source titles and descriptions, and source URLs. Matching is plain —
substrings, no query syntax, no relevance ranking. Article body text lies
beyond its reach in v1.
