# Inzpo — Domain Language

Glossary only: no implementation details live here. Terms are added or
sharpened the moment they crystallise.

## Terms

**Item** — A single saved piece of design inspiration. Inzpo recognizes six
kinds of Item: URL, screenshot, photo, palette, article, and video. An Item
is one captured thing: its kind is fixed when it is captured and never
changes afterward.

**Capture** — The act of adding an Item to the library. Capture flows are
designed to be mobile-friendly from day one.

**Source** — The outside address a URL, article, or video Item points at.
What Inzpo knows about the source — title, description, poster image — is
copied into the Item at capture; the Item shows and edits the copy, and
never depends on the source staying reachable or unchanged.

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
longer dependent on it. Filtering by Color matches Items' extracted colors
against a fixed color taxonomy — Color has no user-maintained vocabulary.

**Collection** — A manually curated, ordered group of Items. An Item may
live in any number of Collections. A Collection carries no Facets of its
own — Facets live on Items. Deleting a Collection never deletes its Items.

**Smart collection** — A saved filter query that resolves to a live set of
Items: the query runs fresh, so membership follows the Items. Distinct
from a Collection — membership is by query, not by hand.
