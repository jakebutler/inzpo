# Inzpo v1 — Architecture review

**Date:** 2026-09-14
**Scope:** `main` at `7a49979` ("Polish pass complete"), reviewed against `docs/spec/v1.md`, ADR-0001..0004, `CONTEXT.md`, and `docs/ux/audit.md`.
**Method:** every claim below was checked by reading the code; file pointers are relative to the repo root. `npx tsc --noEmit` is clean.

Summary: the implementation is close to the spec and the four ADRs are honored in their load-bearing parts (single `items` table, copy-at-capture for previews and article bodies, private R2 behind an authenticated proxy, passphrase + jose cookie with destination-preserving login). The important gaps are (1) a correctness bug where bulk "select all" ignores the collection scope, (2) no kind override before Save, (3) the share target saves immediately instead of landing on the pre-filled capture surface, (4) a SQL-injection-shaped `sql.raw` in vocabulary merge, and (5) zero non-PK indexes plus an unbounded Wall query, which will hurt well before 10k items. None of these require a rewrite.

---

## 1. Spec conformance matrix

| Area | Status | Where | Note |
|---|---|---|---|
| Item model & six kinds (§2, ADR-0002) | **Implemented** | `lib/db/schema.ts`, `lib/items.ts`, `lib/capture-url.ts`, `lib/palettes.ts` | Single `items` table + attachment tables; `kind` set once at insert and never updated anywhere (`grep` confirms no `set({ kind` ). Per-kind validity minimums are enforced only implicitly (see §2 below). |
| Capture surface: paste URL / drop image, two-stage tray, auto-tags (§4.1 + Addendum) | **Implemented** | `app/capture/CaptureForm.tsx`, `app/capture/TagTray.tsx`, `lib/relevance.ts`, `app/api/preview/route.ts` | Intake → `/api/preview` → preview card → relevant facets + "auto" marker → Save → `?saved=` re-arm + sonner toast with View action. |
| Kind auto-guess + **one-tap override before Save** (§4.1, ADR-0002) | **Deviates** | `app/capture/CaptureForm.tsx:64,172` | Spec: "capture flows pre-select it via detection with a one-tap override *before* Save". Code renders only a read-only badge: `{KIND_LABEL[kind] ?? kind} · detected` and `kind` is derived, not state. There is no control to flip photo↔screenshot or url↔video↔article, and the server ignores any kind hint anyway (`createImageItem` re-derives from filename, `createLinkedItem` from page signals). "This is really a video" currently cannot be expressed at all for non-oEmbed URLs. |
| Duplicate notice (§4.2) | **Implemented** | `app/capture/CaptureForm.tsx:227-262`, `app/api/duplicate-check/route.ts`, `lib/capture-url.ts:findExistingByNormalizedUrl`, `lib/url.ts` | Debounced, non-blocking, names the existing Item, links to it. Normalization strips fragment, trailing slash, `utm_*`/`fbclid`/`gclid` etc. |
| Share target (§4.4) | **Partial / Deviates** | `app/manifest.webmanifest/route.ts`, `app/share/route.ts`, `middleware.ts` | Manifest declares Level 3 (`url/text/title` + `files: image/*`); `/share` is exempt from middleware; cold-start path stashes the image to `tmp/` and preserves prefill through login (ADR-0004 §9.5 honored). **Deviation:** spec says the shared URL/image "lands pre-filled in the smart bar; kind auto-guessed with one-tap override; tag tray fully expanded; Save closes the window". Authed `POST /share` instead calls `createImageItem` / `createLinkedItem` directly and redirects to `/capture?saved=` — no preview, no override, no tags. The unauthenticated path does the spec'd thing (redirects to `/capture?url=` / `?shareToken=`), so the two paths behave differently. Also: `tmp/` stash objects are never reaped if the login never completes. |
| Article archive (§4.5, ADR-0003) | **Implemented** | `lib/article.ts`, `lib/capture-url.ts:96-105,152-172`, `app/items/[id]/page.tsx` (Archived copy section) | Readability on the already-fetched HTML, allow-list sanitizer strips img/iframe/script/style and all attributes except a re-validated `href`; stored at `items/{ulid}/article.html`; served via media proxy; read-only; excluded from text search. |
| Video embeds (§4.6, §8.5) | **Implemented** | `lib/kind-guess.ts` (YouTube/Vimeo oEmbed), `lib/capture-url.ts:78-90`, `app/items/[id]/page.tsx` (`embedSrc`) | oEmbed `thumbnail_url` copied through the pipeline; `html` stored; detail page extracts the `src` and renders a sandboxed iframe. Note the sandbox is `allow-scripts allow-same-origin …` — fine cross-origin, but it does not add much over no sandbox. |
| Ontology: six fixed facets, seeded vocab, create-on-type, uniform multi-value (§3.1) | **Implemented** | `lib/ontology-seeds.ts`, `scripts/seed-ontology.mts`, `lib/ontology.ts:ensureFacetValue/attachTags` | Seeds match the spec table exactly. Facet set is data, not enum. |
| Vocabulary lifecycle: rename / merge / remove-if-unused / saved-state propagation (§3.2) | **Implemented** (with a security bug) | `lib/vocab.ts`, `app/vocab/actions.ts`, `app/vocab/MergeForm.tsx` | Rename and merge rewrite `smart_collections.filter_state`. Remove is gated by live usage both in UI and server. **Bug:** `mergeFacetValues` builds `sql.raw(\`array['${all.join("','")}']::text[]\`)` from form-supplied ids — string-interpolated SQL. Single-user and auth-gated, but it is a real injection surface and trivially fixable (see Rec. 4). |
| Free tags: own namespace, promotion (§3.3) | **Implemented** | `lib/db/schema.ts:freeTags/itemFreeTags`, `lib/vocab.ts:promoteFreeTag` | Separate table = separate namespace. Promotion inserts assignments, deletes the tag, and moves saved-state selections into `facetValues` with the same stance. |
| Filter bar semantics: tri-state, any-of within / AND across, text reach, sorts, live count (§5.2–5.5) | **Implemented** | `lib/filter.ts`, `lib/wall-query.ts`, `app/components/FilterBar.tsx`, `app/api/filter-count/route.ts` | Query shape matches the spec. Minor: `parseFilterParam` calls `decodeURIComponent` on a value Next has already decoded, so a text query containing `%` (e.g. "100%") throws and silently resets to `EMPTY_FILTER`. Minor: `/api/filter-count` ignores `?c=` collection scope, so the sheet's "N items match" is library-wide while the Wall is scoped. |
| Color dimension (§5.3, §8.3) | **Implemented** | `lib/colors.ts:hexToFamily`, `lib/extract-colors.ts`, `lib/wall-query.ts` (colors block) | 14 families, deterministic mapping, node-vibrant six swatches on a ≤256px buffer + `sharp.stats().dominant` fallback, persisted as hex+family; filtering is a DB query. |
| Smart collections / Saved popover (§5.6) | **Implemented** | `lib/saved-searches.ts`, `app/actions/saved.ts`, `app/components/SavedPopover.tsx` | Stores full `FilterState` + sort, runs fresh, live counts via `/api/filter-count`, rename/delete. |
| Collections: ordered, many-to-many, delete keeps Items (§2.7) | **Implemented** | `lib/collections.ts`, `lib/item-collections.ts`, `app/actions/collections.ts` | `position` assigned as `max+1`; FK cascade on collection delete removes memberships only. No reorder UI in v1 (spec mentions hand-ordering only as a property, not a v1 screen). |
| Selection & bulk ops (§7) | **Deviates (correctness bug)** | `app/components/WallGrid.tsx:66-100,236-243`, `app/actions/bulk.ts:resolveIds`, `app/page.tsx:95-110` | Select toolbar + long-press, tag assign/remove, collection add/remove, delete with count-naming confirm — all present. **Bug:** spec says "Selection is scoped to the Wall, which covers Collection browsing too". `app/page.tsx` computes `count` with `collectionId` but does not pass `collectionId` to `WallGrid`; `WallGrid.hiddenTarget` sends only `f`; `bulk.ts:resolveIds` calls `buildWallQuery(state)` with no collection. So inside a collection of 12, "Select all (12)" → "Delete all 12 items?" → the server deletes every Item in the library matching the filters. Same for bulk tag/collection ops. |
| Media pipeline: derivatives, layout, write order, mime from sharp (§8.1–8.2) | **Partial** | `lib/media.ts`, `lib/r2.ts`, `lib/items.ts:createImageItem`, `lib/capture-url.ts` | `w1600/w640/w256` WebP + 24px placeholder, EXIF `.rotate()`, `items/{ulid}/…` keys, original stored byte-exact, mime from `sharp().metadata()`. Write order is "row (`preparing`) → objects → flip `ready`" as specified, with an inline compensating delete on failure. **Missing:** the spec's reaper ("a reaper deletes prefixes for rows that never became ready"). If the function is killed mid-capture (Vercel timeout, Neon outage during the final `update`), the `preparing` row and any uploaded objects persist forever; the Wall hides them (`capture_state = 'ready'`) so they are invisible orphans. Animated inputs: first-frame derivation is implicit (sharp default page 0) — fine. |
| URL previews: fetch hygiene, metascraper, copy-not-hotlink (§8.4, ADR-0003) | **Implemented, one deviation** | `lib/fetch-url.ts`, `lib/ssrf.ts`, `lib/capture-url.ts` | 10s timeout, 5MB cap, manual redirects with per-hop DNS/private-range check, browser UA, metascraper bundles as listed. Preview bytes copied through the pipeline; provenance URL retained. **Deviation:** ADR-0003: "Never render a hotlinked source URL in the UI." `app/capture/CaptureForm.tsx:159` renders `<img src={preview.image}>` where `preview.image` is the raw `og:image` URL returned by `/api/preview`. It is pre-Save and transient, but it is a literal hotlink in the UI and will show broken images for referer-checked/signed sources — the exact case the ADR names. |
| Auth (§9, ADR-0004) | **Implemented** | `middleware.ts`, `lib/auth/*`, `app/login/*`, `app/media/[...key]/route.ts` | Timing-safe passphrase compare (via sha256 digest, so lengths do not leak), HS256 jose cookie with fixed 180d, `httpOnly`/`Secure`/`Lax`, same-origin relative redirect validation (`validateRelativePath` blocks `//`, `\\`, `://`, control chars), media proxy checks the cookie and serves `private, immutable`. Rate limiting is an in-memory `Map` (`lib/auth/ratelimit.ts`), which on Vercel is per-instance and resets on every cold start — effectively decorative in production. ADR allows "or a Vercel Firewall rule"; that is the honest option. |
| Item detail view (§5.7) | **Implemented** | `app/items/[id]/page.tsx` | Substance, source box, embed, archived copy, colors with families, facet groups, free tags, Origin/Derived, collection memberships, open-source, delete. `getItemDetail` returns `origin: null` unconditionally (dead field; page uses `getOrigin` separately). |
| Edit mode: in-place ✎ Edit, Done/Cancel, source copy, tag trays (§6.1) | **Partial** | `app/items/[id]/edit/page.tsx`, `app/items/[id]/edit/actions.ts` | Coverage matches (title, note, source url/title/description, facet + free tag trays, archived copy locked). **Deviation:** spec says Edit "switches it in place"; implementation is a separate route `/items/[id]/edit`. Functionally fine; a UX-fidelity gap, not a domain one. Cancel is a plain `<Link>` so the snapshot/revert requirement is trivially satisfied. |
| Palette color editor (§6.2) | **Implemented** | `app/items/[id]/edit/PaletteColorEditor.tsx`, `lib/colors.ts`, `lib/palettes.ts:updatePaletteColors` | HSV drag + hue, HEX/RGB/CMYK, family presets, add/remove/reorder, family re-derived server-side. `updatePaletteColors` is delete-then-insert without a transaction (see §3). |
| Palettes & Origin (§2.4) | **Implemented, one nit** | `lib/palettes.ts`, `app/actions/palettes.ts`, `lib/db/schema.ts:origins` | Snapshot copy + `origins` row; deleting the Origin cascades the link row only, derived Item survives (verified by `scripts/e2e-rich.mts:54`). Nit: spec title chain is "fetched title → filename → **first color hexes** → Untitled"; `createPaletteFromItem` inserts `title: null`, so derived palettes show "Untitled" instead of their hexes. |
| Vocabulary manager screen (§6.3) | **Implemented** | `app/vocab/page.tsx` | Six facets + free tags, live usage counts, create/rename/merge/remove/promote, "Manage vocabulary ›" link from edit mode. |
| Deletion: hard, cascades media + assignments + memberships (§2.6) | **Implemented** | `lib/items.ts:deleteItem`, `lib/r2.ts:deletePrefix`, schema FKs | Objects by prefix first, then row (FK cascades do the rest). If R2 is down, `deletePrefix` throws and the row survives — retry is free, as the spec wants. |
| Text search reach (§5.4) | **Implemented** | `lib/wall-query.ts` (text block) | title, note, facet values, free tags, source title/description/url; article body excluded. Mixed `lower() like` vs `ilike` but semantically equal. |

---

## 2. Domain model vs schema

Files: `lib/db/schema.ts`, `drizzle/0000_dazzling_karen_page.sql` (the two agree; snapshot is in sync).

**What matches the glossary / ADR-0002**

- One `items` table with `kind`, `title`, `note`, timestamps, plus a `capture_state` flag for the write-order protocol. Attachment tables `item_sources` (1:1, PK = item_id), `media_assets`, `item_colors`, `item_facet_values`, `item_free_tags`, `collection_items`, `origins`. No JSONB polymorphism except `media_assets.variants` (a key map, which the spec explicitly endorses as "the DB record of what exists").
- `media_assets.mime` present for the post-v1 uploaded-video slot.
- `facet_values (facet_id, value)` unique index — vocab values unique per facet.
- `free_tags.name` unique and in its own table — the namespace separation the glossary requires.
- `origins` as a link table with `ON DELETE CASCADE` on both sides. The task brief asks about "Origin nullable FK with ON DELETE SET NULL"; the link-table shape achieves the same semantics (deleting the Origin removes the link, derived row survives) and avoids a nullable column on `items`. Acceptable; the e2e test asserts it.
- `collection_items.position` integer per membership — the ordered many-to-many the glossary wants.

**Missing constraints (application-only invariants today)**

| Invariant | Status | Fix shape |
|---|---|---|
| `items.kind ∈ six kinds` | No `CHECK`; `text` column | `CHECK (kind IN (...))` or a `pgEnum` — the spec says "stored as data (not enum types)" about *facets*, not kinds; a CHECK is fine. |
| `items.capture_state ∈ {preparing, ready}` | No CHECK | Same. |
| `media_assets.role ∈ {primary, preview}` | No CHECK | Same. |
| **At most one media asset per Item** (glossary: "at most one media asset") | **No unique on `media_assets.item_id`**; `getItemDetail`/`getWallItems` paper over it with `limit 1` | `UNIQUE (item_id)` — one line in schema + a migration. Also makes the `limit 1` subqueries cheap. |
| Case-insensitive uniqueness of vocab values and free tags | `facet_values_facet_value_uq` and `free_tags_name_unique` are **case-sensitive**, but every lookup (`ensureFacetValue`, `ensureFreeTag`, `createFacetValue`, `promoteFreeTag`, `renameFacetValue`) matches on `lower()`. Two concurrent captures can insert `Minimal` and `minimal`; `onConflictDoNothing` will not catch it. | Replace with `UNIQUE (facet_id, lower(value))` / `UNIQUE (lower(name))` expression indexes. Those also make the `lower()` lookups index-backed. |
| `item_colors.hex` format, `position` unique per item | None | Low priority. |
| Palette ≥ 1 color, linked kinds have a source, image kinds have media | Application-only (ADR-0002 says this is by design) | Acceptable; but see `updatePaletteColors` transaction note in §3. |
| `origins.derived_item_id ≠ origin_item_id` | None | `CHECK (derived_item_id <> origin_item_id)`; the detail page already has a defensive branch for `originId === item.id`. |
| `smart_collections.filter_state` shape | Free JSONB; `normalizeFilterState` re-validates on read | Fine. |

**Index coverage — there are no indexes beyond PKs and the two uniques.** This is the single biggest 10k-item risk.

Hot paths and the missing index for each:

| Query | File | Missing index |
|---|---|---|
| Wall: `where i.capture_state = 'ready' order by i.created_at desc` | `lib/wall-query.ts` | `items (capture_state, created_at desc)` |
| Wall row subqueries on `media_assets where item_id = i.id` (×4 per row) | `lib/items.ts:getWallItems` | `media_assets (item_id)` (or the UNIQUE above) |
| Wall row subquery `item_colors where item_id = i.id`; color filters `exists (… c.item_id = i.id and c.family in …)` | same + `wall-query.ts` | `item_colors (item_id, family)` |
| `item_sources where item_id = i.id` | same | PK already covers. |
| Duplicate check `where s.url_normalized = $1` | `lib/capture-url.ts:findExistingByNormalizedUrl` | `item_sources (url_normalized)` — currently a seq scan on every keystroke (debounced) |
| Usage counts `count(*) from item_facet_values where facet_value_id = $1` per value; `from item_free_tags where free_tag_id = $1` per tag | `lib/ontology.ts:getFacetsWithValues`, `app/vocab/page.tsx` | `item_facet_values (facet_value_id)`, `item_free_tags (free_tag_id)` — the composite PKs lead with `item_id`, so these are seq scans, run once per value on **every Wall render** (the Wall calls `getFacetsWithValues`). ~40 seed values × 10k-row seq scan per page load. |
| Facet include/exclude: `ifv.item_id = i.id and fv.facet_id = $1 and lower(fv.value) in (…)` | `wall-query.ts` | PK covers `item_id`; `facet_values (facet_id, lower(value))` expression index helps the join. |
| `collection_items where item_id = $1` (memberships, `getItemCollections`) | `lib/item-collections.ts` | `collection_items (item_id)` |
| `origins where origin_item_id = $1` | `lib/palettes.ts:getDerivedItems` | `origins (origin_item_id)` |
| Media proxy: `where m.original_key = $1 or exists (jsonb_each_text(m.variants) … v.value = $1)` | `app/media/[...key]/route.ts` | Not indexable as written; the jsonb scan is a full table scan **per image request**, and each Wall render triggers one per card. See Rec. 5. |

**Other things that will hurt at ~10k items**

- `getWallItems` has **no `LIMIT`** and materializes 9 correlated subqueries (two of them `jsonb_agg`) per row, then ships every row to the client as props. At 10k items that is a multi-MB RSC payload and a multi-second query on Neon Free. The spec calls wall scaling "an implementation decision" — but the decision has not been made yet. A `LIMIT`/cursor is the minimum.
- `resolveIds` in `bulk.ts` loads every matching id into memory and then runs one `attachTags`/`deleteItem` per id sequentially — `attachTags` is itself 2–4 round-trips per tag. Bulk-tagging 5k items is ~15k serial Neon HTTP requests inside one server action; it will hit Vercel's function timeout. Set-based SQL (`insert … select … where i.id in (subquery)`) is the fix and is already the pattern used in `promoteFreeTag`.
- Text search is `like '%q%'` over five tables; fine at 10k without trigram, but no room to grow. Not a v1 blocker.

---

## 3. Layering and boundaries

**Dependency map (verified by imports)**

```
app/page.tsx ──────────► lib/items, lib/ontology, lib/filter, lib/colors, lib/saved-searches, lib/collections, lib/db (direct query for free tags)
app/capture/page.tsx ──► app/capture/tray (→ lib/ontology), lib/db (direct query for saved title)
app/capture/actions.ts ► lib/items, lib/capture-url, lib/ontology, lib/url, lib/r2 (direct R2 GET/DELETE for the share stash)
app/items/[id]/page.tsx► lib/items, lib/ontology, lib/item-collections, lib/palettes
app/items/[id]/edit/actions.ts ► lib/db + schema directly (updates items, item_sources; deletes tag rows), lib/ontology, lib/url
app/actions/bulk.ts ───► lib/db directly (raw SQL deletes, id resolution), lib/ontology, lib/items, lib/wall-query, lib/filter, lib/collections
app/actions/{collections,palettes,saved}.ts ► thin wrappers over lib/* (good)
app/vocab/actions.ts ──► lib/vocab (good); app/vocab/page.tsx ► lib/db directly for free-tag usage counts
app/share/route.ts ────► lib/items, lib/capture-url, lib/r2 (inline stash logic), lib/auth/session
app/api/preview ───────► lib/fetch-url, lib/kind-guess, lib/relevance (+ its own og-tag parser)
app/media/[...key] ────► lib/db (raw SQL), lib/r2, lib/auth/session
middleware.ts ─────────► lib/auth/session (jose only — Edge-safe)
```

`lib/` never imports from `app/`. Good.

**Business logic living outside `lib/`**

- `app/items/[id]/edit/actions.ts:updateItem` — the only place that knows how to update an Item (title/note/source/tags, wholesale tag replace). Belongs in `lib/items.ts` as `updateItem(id, patch)` so scripts/tests can exercise it (none do today).
- `app/actions/bulk.ts` — `resolveIds` (the "select all = filter resolution" rule) and two raw-SQL bulk tag removals. Belongs in `lib/bulk.ts`; then the collection-scope bug (§1) gets fixed in one place and tested by `scripts/e2e-bulk.mts`.
- `app/share/route.ts:saveStashedImage` + the matching read/delete in `app/capture/actions.ts` — the `tmp/` stash protocol is split across two files with the key format (`tmp/{ulid}.{ext}`) and the safety check (`startsWith("tmp/") && !includes("..")`) hand-duplicated. Belongs in `lib/share-stash.ts`.
- `app/page.tsx`, `app/vocab/page.tsx`, `app/capture/page.tsx` run their own Drizzle queries (free tag list, free tag usage, saved title). Small, but `listFreeTags({ withUsage })` in `lib/ontology.ts` would remove three ad-hoc queries and give the vocab e2e something to call.
- `app/media/[...key]/route.ts` embeds the "which keys are servable" rule as two raw queries. Belongs in `lib/media-keys.ts` (see Rec. 5).

**Duplicated logic**

| Logic | Copies |
|---|---|
| og-tag regex parsing | `lib/kind-guess.ts:extractOgType` and `app/api/preview/route.ts:ogContent` (second copy also hand-unescapes three entities). Preview title comes from `og:title`; saved title comes from metascraper — they can differ, so the user sees one title before Save and another after. |
| Screenshot filename heuristic | `lib/media.ts:looksLikeScreenshot` and inline `/screenshot/i.test(file.name)` in `app/capture/CaptureForm.tsx:64`. |
| `safeHost()` | `app/capture/CaptureForm.tsx:38` and `app/api/preview/route.ts:20`. |
| oEmbed dynamic `import("@/lib/fetch-url")` inside `createLinkedItem` when `fetchPage` from the same module is already statically imported | `lib/capture-url.ts:83` — harmless, but confusing. |
| `.env` loader preamble (8 lines) | Copied verbatim into all 13 `scripts/*.mts` and `tests/*.mts`. |
| Filter parsing / URL normalization | **Not** duplicated — `lib/filter.ts` and `lib/url.ts` are the single sources; every caller goes through them. Good. |

**Server/client boundary** — clean.

- Every `"use client"` file imports only React, UI primitives, gsap, server actions, and pure/isomorphic `lib` modules (`lib/filter`, `lib/colors`, `lib/relevance`). `ItemKind` is imported as `type` (erased). No client file touches `lib/db`, `lib/r2`, `sharp`, or `process.env`.
- Secrets are only read in server modules (`lib/db`, `lib/r2`, `lib/auth/*`, route handlers). No `NEXT_PUBLIC_*` exists.
- `middleware.ts` imports only `lib/auth/session` (jose) — Edge-compatible.
- Heavy libs: `sharp`, `@aws-sdk/client-s3`, metascraper and `re2` are in `serverExternalPackages`; metascraper bundles and `node-vibrant` are dynamically imported so the Wall/detail lambdas do not pay for them. `linkedom` + `readability` are statically imported by `lib/article.ts`, which is dynamically imported from `capture-url.ts`. Good discipline.
- One nit: `app/items/[id]/edit/page.tsx` imports `TagTray` and `loadTrayFacets` from `app/capture/…` — shared UI living under a sibling route. Move to `app/components/` when convenient.
- `app/share/route.ts` has unused imports (`sql`, `items`, `GetObjectCommand`, `DeleteObjectCommand`).

**Transactions — there are none, and the driver cannot provide them as configured.**

`lib/db/index.ts` uses `drizzle-orm/neon-http`, whose `db.transaction()` throws ("No transactions support in neon-http driver"). Every multi-statement write is therefore a sequence of independent autocommits:

| Write | Statements | Failure mode if interrupted |
|---|---|---|
| `createLinkedItem` | insert `items` → insert `item_sources` → (R2) → insert `media_assets` → update `item_sources` → tags → update `ready` | Compensating delete in `catch`; OK unless the process dies. |
| `createPaletteFromItem` | insert `items` (already `ready`!) → insert colors → insert `origins` | A palette Item with zero colors and no Origin is visible on the Wall — violates the "≥1 color" minimum. Note it is inserted as `ready` first, so the write-order protocol is not followed here. |
| `updatePaletteColors` | `delete` all colors → `insert` new | Palette left with **zero colors** if the insert fails; the same "≥1 color" invariant breaks. |
| `updateItem` (edit) | update items → update sources → **delete all facet rows → delete all free-tag rows → re-attach** | Item silently loses all tags. |
| `mergeFacetValues` | update assignments → delete duplicates → delete values → rewrite N saved searches | Partial merge leaves assignments pointing at deleted values (FK cascade deletes them) — data loss. |
| `promoteFreeTag` | insert assignments → delete tag assignments → delete tag → rewrite saved | Similar. |
| `bulkDeleteAction` etc. | N sequential calls | Partial application; acceptable per spec ("one inverse action away") except delete. |

Fix options that stay inside ADR-0001: (a) switch `lib/db/index.ts` to `drizzle-orm/neon-serverless` (WebSocket `Pool`) which supports `db.transaction` — one-file change, works on Vercel Node runtime; or (b) keep neon-http and use `db.batch([...])` (neon-http supports batch as a single transaction) for the fixed-shape cases (`updatePaletteColors`, `createPaletteFromItem`, edit tag replace), and rewrite `merge`/`promote` as single CTE statements. (a) is simpler and covers everything.

---

## 4. Operational readiness

**Env vars.** `.env.example` lists exactly the seven the code reads (`DATABASE_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_PASSPHRASE`, `AUTH_SESSION_SECRET`) — complete. Every read is a bare `process.env.X!`; nothing validates at boot. A missing `AUTH_SESSION_SECRET` surfaces as a jose error on the first request; a missing `R2_BUCKET` as an S3 400 mid-capture (after the `preparing` row is written). A 20-line `lib/env.ts` that throws at import with the variable name would turn these into deploy-time failures. `.gitignore` correctly excludes `.env` and `.env.*` (keeps `.env.example`).

**Migrations.** `drizzle.config.ts` + `drizzle/0000_*.sql` + `drizzle/meta/` are consistent. `scripts/migrate.mts` runs Drizzle's `migrate()` over the folder and is wired as `npm run db:migrate`. `scripts/seed-ontology.mts` is idempotent but is **not** in `package.json` scripts and is not run by the migration, so a fresh deploy has six facets missing until someone remembers it. There is no build-time or deploy-time hook that runs migrations; the workflow is manual (`db:generate` → commit → `db:migrate` against the pooled URL from `.env`). Adequate for one owner; document it in README (the README is still the pre-build "wayfinding" text and says nothing about running the app).

**Error handling and logging.** There are **zero** `console.error`/`console.warn` calls in `lib/` and `app/`, and 23 empty `catch {}` blocks. Every degradation path (preview fetch failed, oEmbed failed, article archive failed, R2 delete failed, share stash failed, palette payload malformed, vocab remove gated) is silent. The user-facing surface is five generic `?error=` codes on `/capture`. When a capture comes back "metadata-only" there is no way, even in Vercel logs, to learn why. Minimum: `console.warn("[capture] preview failed", { itemId, url, err })` in each catch — Vercel captures stdout per invocation for free. Vocab actions swallow the "still in use" error rather than surfacing it.

**Failure scenarios walked through in code:**

- *R2 down mid-image-capture* (`lib/items.ts:createImageItem`): row inserted as `preparing` → first `PutObject` throws → `catch`: `deletePrefix` throws too (swallowed) → `db.delete(items)` → rethrow → action redirects `?error=bad-image` (wrong message: says the file could not be processed). Net state: clean. 
- *Neon pooler down mid-capture after uploads*: `db.insert(mediaAssets)` or the final `update … ready` throws → `catch`: `deletePrefix` succeeds → `db.delete(items)` throws → the user gets `capture-failed`; the `preparing` row survives (invisible) and, if the delete happened before the throw, no objects. If it dies between upload and delete, orphaned objects. No reaper exists to reconcile either direction.
- *Neon cold start (~5 min idle)*: every page is `force-dynamic` and the Wall does six parallel queries plus `getFacetsWithValues`' N usage subqueries; first paint after idle will be several seconds. The media proxy then does **two more Neon queries per image**. A cold Wall with 40 cards = 1 + 80 Neon round-trips before images show.
- *Vercel Hobby request body limit*: `next.config.ts` sets `serverActions.bodySizeLimit: "25mb"`, and `/share` accepts files up to 25 MB, but Vercel serverless functions reject request bodies over **4.5 MB** at the platform edge (413) before Next sees them. A modern phone photo (5–12 MB) will fail to capture on production with no app-level error. Either document/enforce a client-side cap, downscale in the browser before upload, or use a presigned direct-to-R2 PUT (still inside ADR-0001: R2 + Route Handler).
- *Function duration*: `createLinkedItem` does DNS + fetch (10 s) + metascraper + oEmbed fetch + image fetch (10 s) + sharp ×4 + 4 R2 puts + article extraction, serially. Hobby's default is 10 s (configurable to 60 s via `maxDuration`). No route exports `maxDuration`. Slow sources will time out at the platform after the `preparing` row exists — another reaper case.

**Cold-start weight.** Native/large server deps: `@img` (sharp binaries, 16 MB), `re2` (18 MB, pulled by metascraper's `url-regex-safe`), `@aws-sdk` (11 MB), `linkedom` (3.9 MB). All are external or dynamically imported, so only the capture lambda pays. `gsap` (6.3 MB on disk, ~70 KB gz in the client bundle) is used for entrance animations on capture and the tray; `docs/ux/audit.md` says the chosen library is `motion`, so this is a small doc/impl drift. `shadcn` (the CLI) is in `dependencies` rather than `devDependencies`; `radix-ui` is the monolithic package — fine at this scale.

**`next.config.ts`.** No `images` config because the app uses raw `<img>` via the media proxy rather than `next/image` (ADR-0001 mentions `next/image`; the proxy approach is a reasonable substitute that avoids Vercel image-optimization quotas, but is a silent departure). No `maxDuration`, no `headers()` for CSP on HTML pages (only the media proxy sets one). `eslint.config.mjs` exists; `npm run lint` is not part of any check.

**Scripts and CI.** There is no `.github/workflows/`. Unit tests (`vitest`, 40 tests across 10 files) are pure and CI-safe. The nine `scripts/e2e-*.mts` files are **library-level integration scripts**, not HTTP tests: they load `.env` by hand, import `lib/*` directly, write to **whatever `DATABASE_URL` points at** (the Owner's real Neon + R2), and clean up in `finally`. They do assert (5–7 `throw`s each) — filter semantics, bulk order, vocab propagation, sanitizer leaks, origin cascade, derivative dimensions — but `scripts/e2e-url.mts` asserts nothing (prints ✓/✗ and always exits 0). `scripts/cleanup-e2e-debris.mts` exists because crashed runs leak Items/values into the real library. `tests/e2e-share.mts` and `tests/polish-shots.mts` hard-code the **production** Vercel URL and mint a session token from the real `AUTH_SESSION_SECRET`; `tests/e2e-browser.mts` defaults to production too. None of these can run in CI without a disposable Neon branch + R2 bucket; with those (Neon branching is free on the Free tier) all nine `scripts/e2e-*` become CI-runnable unchanged, because they only need `DATABASE_URL`/`R2_*`.

---

## 5. Top 10 recommendations (by leverage)

1. **Fix bulk "select all" to honor collection scope.** *(S, v1 blocker — data loss)*
   `app/page.tsx`: pass `collectionId` to `WallGrid`; `WallGrid.hiddenTarget`: `fd.set("c", collectionId)`; `bulk.ts:resolveIds`: `buildWallQuery(state, formData.get("c"))`. Do the same for `/api/filter-count` (accept `c`) so the sheet count matches the Wall. Add a case to `scripts/e2e-bulk.mts` that selects-all inside a collection and asserts only members are affected.

2. **Add the missing indexes and the at-most-one-media constraint.** *(S, v1 blocker at scale)*
   New migration `drizzle/0001_indexes.sql` via schema edits in `lib/db/schema.ts`: `items (capture_state, created_at desc)`; `UNIQUE media_assets (item_id)`; `item_colors (item_id, family)`; `item_sources (url_normalized)`; `item_facet_values (facet_value_id)`; `item_free_tags (free_tag_id)`; `collection_items (item_id)`; `origins (origin_item_id)`; replace the two vocab uniques with `lower()` expression uniques. Add `CHECK` on `kind`, `capture_state`, `role`.

3. **Get real transactions: switch `lib/db/index.ts` to `drizzle-orm/neon-serverless`.** *(S–M, v1 blocker for palette/edit integrity)*
   One file: `import { Pool } from "@neondatabase/serverless"; drizzle(new Pool({ connectionString }))`. Then wrap `updatePaletteColors`, `createPaletteFromItem` (and insert it as `preparing` → `ready` like the others), `updateItem`'s tag replace, `mergeFacetValues`, `promoteFreeTag` in `db.transaction`. `scripts/*.mts` keep working (same `db` export).

4. **Remove the `sql.raw` string interpolation in `mergeFacetValues`.** *(S, v1 blocker — injection)*
   `lib/vocab.ts:41`: replace `sql.raw(\`array['${all.join("','")}']::text[]\`)` with `inArray(facetValues.id, all)` (Drizzle) — the same pattern already used three lines later. Also validate `mergeIds` are ULIDs in `app/vocab/actions.ts`.

5. **Make the media proxy cheap: drop the two per-image Neon queries.** *(S, follow-up but high UX leverage)*
   `app/media/[...key]/route.ts`: the cookie check plus the `items/` prefix + ULID-shaped path (`/^items\/[0-9A-HJKMNP-TV-Z]{26}\/(original\.\w+|w(1600|640|256)\.webp|article\.html)$/`) is sufficient authorization (ADR-0004 says unguessable keys are not the boundary — the cookie is, and it is still checked). Let R2's `ContentType` drive the response; return 404 on `NoSuchKey`. Fold the "servable key" rule into `lib/r2.ts`. This removes ~2 Neon round-trips per card on every Wall paint.

6. **Bound the Wall query and stop computing vocab usage on every render.** *(M, v1 blocker before ~2–3k items)*
   `lib/items.ts:getWallItems`: add `limit`/`offset` (or `created_at` keyset) and a "Load more" in `WallGrid`; keep `countWallItems` for the honest total. `app/page.tsx`: call a new `getFacetsWithValues({ usage: false })` — the Filter bar only needs names. Consider replacing the correlated `jsonb_agg` subqueries with `LEFT JOIN LATERAL`s once paginated; measure first.

7. **Add the reaper the spec requires, and cover `tmp/` stashes.** *(S, follow-up)*
   `scripts/reap-orphans.mts` (and a Vercel cron route `app/api/cron/reap/route.ts` guarded by `CRON_SECRET`): delete `items` where `capture_state <> 'ready' and created_at < now() - interval '1 hour'` (FK cascade) and `deletePrefix` for each; list `tmp/` and delete objects older than 24 h. Also export `maxDuration = 60` from `app/capture/actions.ts` and `app/share/route.ts`.

8. **Ship the one-tap kind override, and route the authed share target through the capture surface.** *(M, v1 blocker for spec §4.1/§4.4 conformance)*
   `CaptureForm.tsx`: make `kind` state, seeded from `preview.kind`/filename, with a small segmented control on the preview card (photo/screenshot; url/article/video); POST `kind` in the form. `createImageItem`/`createLinkedItem`: accept an optional `kindOverride` and only fall back to detection when absent (for linked kinds, still run oEmbed/article extraction when the override says video/article). `app/share/route.ts` authed branch: redirect to `/capture?url=…` / stash + `?shareToken=` exactly like the unauthed branch, so both paths land on the pre-filled surface; add a `?closeOnSave=1` flag that `SavedToast` honors with `window.close()`.

9. **Log every swallowed failure, and validate env at boot.** *(S, follow-up)*
   Add `lib/log.ts` (`warn(scope, msg, fields)` → `console.warn(JSON.stringify(...))`) and call it in each of the 23 empty catches with `itemId`/`url`. Add `lib/env.ts` that reads the seven variables once, throws with the name if absent, and is imported by `lib/db`, `lib/r2`, `lib/auth/*`. Surface vocab "still in use" as `?error=` instead of swallowing.

10. **Make the e2e scripts CI-runnable and stop pointing tests at production.** *(M, follow-up)*
    Extract the `.env` loader into `scripts/_env.mts`; make `E2E_BASE` mandatory in `tests/e2e-share.mts` and `tests/polish-shots.mts` (fail fast if unset rather than defaulting to the production URL); add `throw` assertions to `scripts/e2e-url.mts`; add `npm run db:seed` and an `npm run e2e` that runs the nine scripts; add `.github/workflows/ci.yml` running `typecheck`, `lint`, `vitest`, and `e2e` against a Neon branch (`neonctl branches create`) and a scratch R2 bucket. Move `shadcn` to devDependencies while there. Also address the Vercel 4.5 MB body limit (client-side downscale in `ImageDropzone` before submit, or presigned R2 PUT) — this one is arguably a v1 blocker for the "photo from camera roll" flow and could be promoted above.

**Smaller items noted along the way (no ranking):** `parseFilterParam` double-decodes (breaks `%` in search); derived palettes get `title: null` instead of the hex chain; `getItemDetail.origin` is always `null`; `/api/preview` and the Save path can disagree on title; hotlinked `og:image` in the pre-Save preview card (proxy it through `/api/preview` as bytes, or accept and document as the one pre-Save exception); rate limiter is per-instance (use a Vercel Firewall rule as ADR-0004 allows); `Content-Length: ""` header when R2 omits it; Edit is a route rather than in-place; `gsap` vs the audit's `motion`; README still describes the wayfinding phase.
