# ADR-0002: One Item identity space — single core table, kind fixed at capture

**Status:** Accepted (wayfinder ticket [Item model & the six types](https://github.com/jakebutler/inzpo/issues/5))
**Date:** August 2026

## Context

Inzpo recognizes six kinds of Item (URL, screenshot, photo, palette, article,
video) that need very different attachments: linked Source metadata, a media
asset (primary vs preview), colors. The ontology decision (#2) settled
**uniform multi-value** facet/tag assignment, and filtering (#7) demands
one query model across all kinds — text search, tri-state facet filters, and
color filters must hit every kind without per-kind special cases. The data
model must make that cheap.

## Decision

- **A single core `items` table** (`id`, `kind`, `title`, `note`, timestamps)
  with **cross-cutting attachment tables** (source metadata, media assets,
  colors, facet/tag assignments, collection memberships). **Not** polymorphic
  JSONB, **not** per-kind tables.
- The six kinds are not six shapes but **three cross-cutting attachments,
  combined**: linked Source (URL/article/video), Media asset — at most one,
  as **primary** (screenshot/photo substance) or **preview** (linked kinds) —
  and colors (the Palette's substance).
- **Kind is fixed at capture.** Flows pre-select via detection with a one-tap
  override before Save; no post-save kind edits. Reclassifying means
  capturing again — cheap, because attachments are shared infrastructure.
- **Deletion is hard** (one confirm, no trash/undo), cascading to stored media
  files, assignments, and memberships. The only item-to-item link is
  **Origin** (derived Item → source Item); deleting the Origin Item clears the
  link and derived Items survive.

## Alternatives considered

- **Polymorphic JSONB per item** — rejected: facet/tag/color assignment and
  filtering become schema-dependent; the uniform query model has to special-
  case shapes; no relational integrity for shared vocabulary entities.
- **Per-kind tables with a supertype** — rejected: every cross-cutting feature
  (assignments, collections, smart-collection queries, bulk operations) joins
  across six tables or through a union view; migrations multiply by kind.
- **Mutable kind** — rejected: an Item is one captured thing (glossary);
  reclassification ambiguity ("is this screenshot now a palette?") fights the
  domain. Capture-again is honest and cheap.
- **Soft delete / trash** — deferred: additive later if the Owner wants it;
  v1 ships the simpler cascade.

## Consequences

- All six kinds share one identity space, so the ontology, filtering, text
  search, saved queries, and bulk operations need no per-kind branches.
- Per-kind **validity minimums** enforce integrity at the application layer:
  URL required for linked kinds, a media asset for image kinds, ≥1 color for
  palettes.
- The media table carries a **mime type** so an uploaded-video slot can be
  added post-v1 without schema upheaval.
- No albums/carousels: an Item carries at most one media asset; multi-image is
  multiple Items.
- Retroactive dedup (merge-Items) would have been the natural fit for a
  link-heavy model; it is ruled post-v1, consistent with this model's minimal
  link surface (Origin only).
