# Inzpo UX Audit, round 2 (2026-09-14)

Static code review on branch `review/ux-polish` (cut from `origin/main`).
Lenses: accessibility, mobile at 390px, empty/loading/error states, UX copy
(glossary terms from CONTEXT.md), consistency, and the unfixed items from the
2026-09-03 critique. Each finding is rated P0/P1/P2 and marked **fixed** or
**open**. Fixes are local, do not touch server actions or data flow, and do
not change the visual direction.

Totals: P0 0 found · P1 17 found, 16 fixed · P2 16 found, 7 fixed.

## Capture (`app/capture/*`)

| # | P | Lens | Finding | Status |
|---|---|------|---------|--------|
| C1 | P1 | a11y | URL input had placeholder only, no accessible name. | fixed: `aria-label="Link to capture"` |
| C2 | P1 | states | Neither submit button (icon "+" nor sticky Save) reflected pending; double-submit possible, no feedback during upload. | fixed: new `app/components/SubmitButton.tsx` (`useFormStatus` → disabled, `aria-busy`, "Saving…") used for both |
| C3 | P1 | a11y | Dropzone `<button>` had no accessible name beyond decorative copy. | fixed: `aria-label` |
| C4 | P1 | states | "Reading the link…" only appeared inside the dropzone and was not announced. | fixed: persistent `aria-live="polite"` slot |
| C5 | P1 | a11y | Custom-value chips and free-tag chips act as "remove" but were announced only by their value. | fixed: `aria-label="Remove … "` |
| C6 | P1 | states | Server-side capture error had no `role="alert"` and used hardcoded `text-red-400`. | fixed: `role="alert"`, `text-destructive` |
| C7 | P2 | copy | Tray copy said "categories"; glossary term is Facet. | fixed: "relevant Facets first", "N more Facets" |
| C8 | P2 | a11y | "more Facets" toggle lacked `aria-expanded` and was < 36px tall. | fixed |
| C9 | P2 | consistency | `app/capture/ImageDropzone.tsx` is dead code (hardcoded neutral palette, ⬆ glyph); nothing imports it. | open: delete in a cleanup PR |
| C10 | P2 | consistency | Kind badge always shows the Globe icon, even for screenshot/photo files. | open |
| C11 | P2 | mobile | Duplicate notice is absolutely positioned over the preview card and can cover the title row on 390px. | open: consider in-flow placement |
| C12 | P2 | a11y | Facet chips are 34px tall (prior round settled on ≥36px elsewhere). | open |

## Wall (`app/page.tsx`, `FilterBar`, `WallGrid`, `BottomNav`, `SavedPopover`)

| # | P | Lens | Finding | Status |
|---|---|------|---------|--------|
| W1 | P1 | mobile | The `pb-24` spacer sat *above* the grid, so the fixed BottomNav covered the last row of cards. | fixed: spacer moved below `WallGrid`, includes `safe-area-inset-bottom` |
| W2 | P1 | mobile | BottomNav had no `env(safe-area-inset-bottom)` padding; tabs were ~40px tall. | fixed: safe-area padding, `min-h-[48px]`, `aria-current="page"`, `aria-label="Primary"` |
| W3 | P1 | a11y | Selection-mode cards were plain `<div onClick>`: not focusable, not announced, no keyboard toggle. | fixed: `role="checkbox"`, `tabIndex`, `aria-checked`, Enter/Space, focus-visible outline |
| W4 | P1 | a11y | Hover-only card actions (Select / Open source) were unreachable by keyboard (`opacity-0`, `pointer-events-none`). | fixed: `group-focus-within` + `focus-visible` reveal; labels now include the item title |
| W5 | P1 | states | Empty state said "Nothing matches" even for an empty library. | fixed: filter-aware copy ("Nothing matches the Filter bar" vs "The Wall is empty" + Capture link), `role="status"` |
| W6 | P1 | a11y | Filters button did not announce the active-filter count badge; no `aria-expanded`. | fixed |
| W7 | P1 | a11y | SavedPopover is a hand-rolled popover: no Escape, no `role`, no `aria-controls`. | fixed: swapped to the shadcn/Radix `Popover` — Escape, outside-click dismiss, focus restore, `role="dialog"` and `aria-controls` all come from Radix |
| W8 | P1 | control | Deleting a Smart collection / Collection is one click with no confirm or undo. | confirm added: `AlertDialog` inside the Saved popover (delete only fires after confirm); undo still open (data-flow) |
| W9 | P1 | control | Bulk delete and item delete have no undo (critique carry-over). | open (data-flow) |
| W10 | P2 | consistency | Color swatch `aria-label` was `"red include"` while chips say "— included". | fixed: unified wording; `aria-pressed` now means include only, like chips |
| W11 | P2 | consistency | Glyph characters (▢ ✓ ✎) instead of lucide icons in WallGrid/SavedPopover. | fixed: `Square`, `Check`, `Pencil` |
| W12 | P2 | states | Rename inputs in SavedPopover had no accessible name; "None yet." gave no next step. | fixed |
| W13 | P2 | consistency | Dead `stanceMark()` helper in FilterBar; `main` used raw `neutral-*` instead of tokens. | fixed |
| W14 | P2 | consistency | Secondary "Vocabulary / + Capture" text links duplicate BottomNav on mobile and the header button on desktop. | open |
| W15 | P2 | mobile | Selection-mode sticky bar and FilterBar are both `sticky top-0 z-20`; they stack rather than replace. | open |
| W16 | P2 | states | Bulk actions (assign/remove tags, collection add/remove) have no pending or success feedback. | open |
| W17 | P2 | copy | BottomNav label "Vocab" vs page title "Vocabulary manager". | fixed: "Vocabulary" |

## Item detail and edit (`app/items/[id]/*`)

| # | P | Lens | Finding | Status |
|---|---|------|---------|--------|
| D1 | P1 | mobile | Spec says BottomNav is present on detail and vocab; it was rendered only on the Wall. | fixed: BottomNav + safe-area bottom padding on detail and vocab |
| D2 | P1 | mobile | Edit page's sticky Done/Cancel bar had no opaque background, so it floated over TagTray chips (the same defect the prior round fixed on Capture). | fixed: opaque bar with border, safe-area padding |
| D3 | P1 | states | Edit "Done" had no pending state. | fixed: `SubmitButton` ("Saving…") |
| D4 | P2 | copy | Origin section said "its source item" / "derived items"; glossary term is Origin. | fixed |
| D5 | P2 | consistency | ✕ glyph for remove-from-collection; 32px target. | fixed: lucide `X`, 32px square hit area (still < 44, acceptable inside a chip) |
| D6 | P2 | consistency | Detail/edit pages use `bg-neutral-950`/`text-neutral-*` instead of theme tokens throughout. | partially fixed (main wrapper); inner rows open |
| D7 | P2 | a11y | PaletteColorEditor SV area is `role="slider"` with `tabIndex` but no keyboard handling or `aria-valuenow`. | open |

## Vocabulary manager (`app/vocab/*`)

| # | P | Lens | Finding | Status |
|---|---|------|---------|--------|
| V1 | P1 | a11y | Free-tag rename button was a ✎ glyph with no accessible name; create/rename/promote controls under 36px. | fixed: lucide `Pencil`, `aria-label`, `min-h-[36px]` |
| V2 | P2 | states | A facet with zero values rendered an empty list. | fixed: "No values yet — create one below." |
| V3 | P2 | copy | Intro said "the user curates"; glossary says Owner / Vocabulary. | fixed |
| V4 | P2 | a11y | Merge checkboxes were default-size with tiny labels. | fixed: 16px boxes, 36px label rows |
| V5 | P2 | states | Rename/create/merge forms have no pending feedback. | open |
| V6 | P2 | copy | Lowercase button labels ("create", "remove", "merge") differ from Title case elsewhere. | open |

Merge preview (critique P1) is present in `MergeForm.tsx` and reads correctly.

## Login (`app/login/page.tsx`)

| # | P | Lens | Finding | Status |
|---|---|------|---------|--------|
| L1 | P1 | a11y | Passphrase input had no label; error was not announced. | fixed: `aria-label`, `aria-invalid`, `role="alert"` |
| L2 | P1 | states | Sign in button had no pending state. | fixed: `SubmitButton` ("Signing in…") |
| L3 | P2 | consistency | Focus style was a border-color change; now a visible ring on `focus-visible`. | fixed |

## Global (`app/globals.css`, `app/layout.tsx`)

| # | P | Lens | Finding | Status |
|---|---|------|---------|--------|
| G1 | P1 | a11y | GSAP moments checked `prefers-reduced-motion`, but CSS transitions and `tw-animate-css` sheet/popover animations did not. | fixed: global reduced-motion rule |
| G2 | P2 | a11y | No skip link; single-user app with short pages, low impact. | open |

## Carry-overs from the 2026-09-03 critique

- No undo for deletes (W8, W9): still open; needs a soft-delete or toast-with-undo in the action layer.
- Merge preview: present, verified.
- Stance-cycle help: the sheet legend is present; reworded to plain words (no glyphs) so it reads the same to screen readers.
- Naming drift: "Saved" button / "Smart collections" heading / "Save this search" match spec 5.6 and were left as is; "Vocab" → "Vocabulary" and "categories" → "Facets" were aligned.

## Verification

`npm run typecheck` clean, `npm run lint` clean (pre-existing `tests/mint-cookie.mjs` parse error fixed in its own commit), `npm test` 83/83 passing.
