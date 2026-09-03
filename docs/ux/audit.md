# Inzpo v1 — UX Audit & Screen Specifications

Post-build audit (Owner feedback round 1). For each screen: prioritized use
cases, data in/out, data representations, modality/workflow, and the component
inventory (shadcn/ui + custom). This document drives the implementation;
deviations from the original capture-UX decision are recorded in the spec
addendum.

## Design principles applied

1. **Capture is the product's heartbeat** — it gets the most prominent
   affordance on every screen (Instagram's camera rule): a raised center
   action in the mobile bottom bar, a primary button on desktop.
2. **Progressive disclosure** — the capture surface starts empty and calm;
   intelligence (kind guess, relevant facets, auto-tags) arrives *after*
   substance exists, animated, as feedback for what the system detected.
3. **Relevance over completeness** — the Owner curates vocabularies; the
   capture surface should only *surface* what fits the captured thing.
4. **Feedback for every system action** — detection, auto-tags, saves, and
   errors all animate or toast; nothing changes silently.
5. **Library components over bespoke** — shadcn/ui (Radix) primitives +
   `motion` for animation; custom code only for Inzpo-specific behavior
   (tri-state chips, the Wall grid).

## Screen: Wall (browse)

| | |
|---|---|
| Priority use cases | 1. Browse the library at a glance · 2. Narrow via the Filter bar · 3. Enter Capture · 4. Open an Item · 5. Bulk act (Selection) |
| Data in | Filter state (URL `?f=`), collection scope (`?c=`), items (server-resolved), saved searches, collections, facets/tags for the sheet |
| Data out | Item selection (detail navigation), filter state mutations (URL), bulk mutations (tag/collection/delete) |
| Representations | Masonry cards (image + kind + title + color dots + tag chips); active-filter chips (dimension + value + ✓/≠); counts |
| Modality | Scroll + tap (primary); long-press/hover for selection; sheets for filters |
| Components | FilterBar (Input, Select, Popover, Sheet, Badge chips), WallGrid (cards, selection ring, bulk bar), BottomNav (mobile), Button |

## Screen: Capture

| | |
|---|---|
| Priority use cases | 1. Paste a URL → save · 2. Drop/pick an image → save · 3. (after substance) tag with relevant facets · 4. Duplicate awareness · 5. Share-target intake |
| Data in | URL or image file (+ optional tags); duplicate lookup; kind detection + metadata preview |
| Data out | New Item (kind, Source copy or media asset, tags); capture confirmation (`?saved=`) |
| Representations | Stage 1: minimal intake (one input, one dropzone). Stage 2: **item preview card** (thumbnail, title, kind badge "auto-detected", source host) + **relevant facet tray** animating in below the preview, auto-selected chips popping with an "auto" marker |
| Modality | Paste/keyboard (URL) · drag/tap (image) · tap (chips) |
| Components | Input, Button, Card (preview), motion (preview + tray + chips), Badge (chips + auto marker), DuplicateNotice (Alert), SavedToast (sonner action) |

**Flow**: intake → substance detected → preview card springs in → relevant
facets stagger in below it → deterministic auto-tags pop (with "auto"
marker) → Owner adjusts or skips → Save. Zero-tag capture remains fine; the
tray is skippable and never blocks Save.

## Screen: Item detail

| | |
|---|---|
| Priority use cases | 1. See the Item whole · 2. Jump to source · 3. Tag/organize (edit mode) · 4. Collection membership · 5. Delete |
| Data in | Item (detail query), tags, collections, Origin/Derived, Archived copy HTML, oEmbed src |
| Data out | Edits (title/note/tags/Source copy), palette color updates, membership changes, hard delete |
| Representations | Substance (image/reader/embed/palette), metadata rows, Source box, Badge chips (tags), color swatches, Origin links |
| Components | Badge, Button, AlertDialog (delete), Select (collection add), Edit form (Input/Textarea/TagTray/PaletteColorEditor) |

## Screen: Vocabulary manager

| | |
|---|---|
| Priority use cases | 1. See vocabularies + usage · 2. Rename/merge · 3. Create · 4. Remove-if-unused · 5. Promote free tag |
| Data in | Facets + values + usage counts, free tags, saved searches (for propagation) |
| Data out | Vocabulary mutations (propagate into saved filter states) |
| Components | Input, Button, Select, Badge (usage counts), per-row forms |

## Global patterns

- **BottomNav (mobile < md)**: Wall · **＋ Capture (raised, primary)** ·
  Vocabulary. Present on Wall/detail/vocab; hidden on Capture (the screen is
  the chrome there) and login.
- **Toasts**: sonner — capture confirmation carries the View-item action.
- **Motion**: springs (stiffness ~400, damping ~30) for entrance; staggered
  40–60ms for chip/tray cascades; fade+8px rise for cards. Nothing bouncy
  enough to waste the Owner's time.
