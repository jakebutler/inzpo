# Mobile interaction critique — October 9, 2026

## Scope and evidence

Requested by Jake after the one-screen intake, chewing, and balloon-flight
performance reached a promising point on his iPhone. The scope is the rest of
the mobile experience: sign-in, home, editing, Keep, collections, reopened
kits, reuse tools, and recovery. The benchmark is the clarity, responsiveness,
continuity, and craft expected of Apple or Duolingo, without copying their
visual identities.

This audit describes the implementation at commit
`152fdb396c4ae6502cda5fde24d30a39a895abd1`, before the refinement batch.
Line references below refer to that baseline. Evidence is source inspection,
product/design documentation, and inspection of the old login Baku and
approved neutral knit image. It is not a rendered phone review. Actual
clipping, keyboard behavior, native gesture feel, frame rate, and perceived
motion require device evidence. The user's positive capture feedback does
not approve the remaining flows.

The capture scene has a point of view. The rest behaves like a competent CRUD
app wearing that scene's materials. The biggest gap is continuity of purpose:
saving and revisiting should make the inspiration easier to use, but currently
add ambiguity and detours. The correct next pass is a coherent
save → revisit → edit → use loop, not more decorative animation.

## Ranked findings

### 1. P1 — Default Save creates duplicate collections

**Code-proven defect.** `apps/mobile/src/components/KeepScreen.tsx:43–51`
initializes every kit with no selected collection and the new name
“My collection.” Loading the existing collections at lines 67–70 never adopts
a destination. Save posts `newName` by default at line 87.
`lib/collections.ts:28–31` inserts a new collection unconditionally.

Resolve an existing/default destination before enabling Save. Preserve an
explicit new-collection selection when asynchronous loading completes.

**Acceptance:** save three consecutive kits without changing destination and
get one collection containing three kits. Deliberately starting a new
collection remains possible and is not overwritten by loading or retry.

### 2. P1 — Reopening inspiration prioritizes filing over using it

**Design shortcoming proven by composition and action hierarchy.**
`apps/mobile/src/app/(app)/kit/[id].tsx:131,186–203` reserves a full viewport
for the saved composition, makes “See your collection” primary, and puts reuse
tools below it. `apps/mobile/src/components/SavedKit.tsx:24–26` hides editing
behind the closed deck.

Promote “Use this kit,” expose “Edit colors,” and make collection navigation
quieter. A focused reuse sheet is appropriate if it clearly shows what is
being taken into the next project. An ordinary revisit is a working state,
not another save celebration.

**Acceptance:** a reopened kit exposes reuse without exploratory scrolling;
all six roles and honest empties can be inspected; Copy/CSS/JSON do not wait
for the description. Existing kits allow editing as soon as they load,
without waiting for the old result sequence.

### 3. P1 — Back abandons the browsing context

**Code-proven defect.**
`apps/mobile/src/app/(app)/kit/[id].tsx:133` always dismisses to home, even
when the user opened the kit from a collection.
`apps/mobile/src/app/(app)/collection/[id].tsx:23–30` does not reload on focus,
so fixing Back alone would leave edited palette previews stale.

Preserve the browsing stack, retain the list while refreshing, and refresh
on return from a kit. A failed refresh must not erase usable loaded data.

**Acceptance:** open the fifth kit, edit a color, and go Back. The user returns
to the same collection and scroll position with the new color. A failed
refresh retains existing cards and offers retry.

### 4. P1 — Color detail gives false advice for Text and conceals editing

**Code-proven defect and discoverability failure.**
`apps/mobile/src/lib/chip-flip.ts:19–22` compares Text with itself, guaranteeing
poor-contrast advice. `apps/mobile/src/components/ChipDetail.tsx:128–132`
makes the detail card a close button, with editing hidden behind long press.
There is no visible editing instruction.

Check Text against Background and name that pair explicitly. Add visible
“Edit color” and “Copy hex” actions. Preserve the chip flip as an intelligible
transition rather than a gesture puzzle. Avoid showing an invalid-hex error
on every intermediate keystroke; provide a readable live draft preview.

**Acceptance:** dark Text on light Background reports correctly. A new user
can edit without discovering a long press, and Copy does not dismiss detail.
Incomplete typing is not treated as a completed invalid submission. Failed
saves preserve the draft for retry.

### 5. P2 — Save confirmation can change the saved object's size

**Geometry mechanism proven; visible jump requires device evidence.**
`apps/mobile/src/components/KeepScreen.tsx:32–36,77,128–129` derives artwork
scale from measured form height, then replaces the form with one status line
for a 900ms success hold. The smaller form can enlarge the fan and photo
immediately before navigation.

Preserve the form footprint and artwork scale during saving and success.
Confirm the actual destination. The physical kit should remain spatially
stable while its state changes.

**Acceptance:** print and rivet positions remain stable from press through
success, including with the keyboard open and larger text. Controls do not
become actionable again during the saved hold.

### 6. P2 — Tactile feedback disappears during browsing and editing

**Code-proven feedback gaps.**
`apps/mobile/src/app/(app)/collection/[id].tsx:49` has no pressed response.
`apps/mobile/src/app/(app)/collections.tsx:42` only dims the whole object.
Editor role and candidate swatches change selection on release without a
touch-down response.

Use restrained stock compression and selected-state feedback consistently.
Keep readable labels and actual colors visible. Avoid gratuitous entrance
choreography for every row.

**Acceptance:** feedback starts on touch-down, resets after cancellation,
and does not shift neighboring content. Reduced Motion uses tonal feedback
without scale or translation.

### 7. P2 — Reuse feedback conflates progress, success, and missing description

**Code-proven defects.**
`apps/mobile/src/components/KitTools.tsx:18,24,37,47–52` disables every action
without labeling the active operation, calls failed descriptions “still on
its way,” and calls clipboard failure an export failure.

Give the active action an operation label and inline copied state. Distinguish
pending and failed descriptions. Do not claim delivery merely because a
native share sheet closes; cancellation is not successful export delivery.

**Acceptance:** Copy changes to “Copied.” A failed description produces a
truthful colors-only confirmation. Clipboard failure names copying. Closing
or canceling sharing restores usable tools without a false success claim.

### 8. P2 — Recovery states and mascot identity break the visual world

**Source and asset evidence.** Collection empty/error states are paragraphs
with little visual structure; failed detail-card photos have no recovery
treatment (`collections.tsx:32–39`, `collection/[id].tsx:42–52`). Sign-in uses
the old striped Baku (`sign-in.tsx:114`), while capture/home use the approved
knit image.

Use one approved host identity where appropriate, stable paper placeholders,
and a clear next action. Failed images should retain actual palette content.
Do not fabricate photographic or palette previews.

**Acceptance:** denied camera, failed photo, empty collection, failed initial
load, and reload all expose a clear recovery action in the same visual
language. A collection containing useful colors still feels usable when its
photo cannot load.

## Cross-cutting constraints and acceptance

- CollectionSummary provides only id, name, and count
  (`packages/shared/src/types.ts:23–27`). Improve index hierarchy with those
  facts; do not fetch every detail simply to decorate the index or invent
  representative palettes.
- Native-stack Reduced Motion is explicit on collection detail at baseline
  but not centrally in `(app)/_layout.tsx:13`. Verify consistent navigation
  behavior across capture, Keep, collections, and return paths.
- Maintain the existing one-screen capture sequence and actual-color rules.
  This pass must not regress Baku's mesh, intake, flight, or skip controls.
- Source tests establish behavior and regression boundaries, not iPhone
  smoothness. Review a phone recording of save → collection → reopen → edit
  → Back → reuse, including one failed request, at 375/390 widths, larger
  text, and Reduced Motion.

More hero animation cannot compensate for a broken save-and-reuse loop.

## Follow-up review

The refinement implementation was reviewed in the working tree after the
baseline. All eight findings are materially addressed in source:

- Keep resolves an existing destination before saving, preserves an explicit
  destination choice, and holds its form footprint/artwork scale through
  success.
- Saved kits make reuse primary, expose editing, and skip the old result
  interaction delay. Reuse has operation-specific progress and truthful
  description availability, including polling failures.
- Existing collection browsing uses contextual Back and retained-data focus
  refresh. Post-save navigation clears the capture/Keep history before opening
  the saved result, avoiding a stale unsaved result underneath the collection.
- Detail offers visible Edit/Copy actions and correctly checks Text against
  Background. Editing opens expanded, uses a live draft preview, waits until
  blur/submit for invalid-hex feedback, and prevents a dirty sheet from
  collapsing with its finish/cancel actions hidden.
- Collection cards, color choices, the saved deck, and collection selection
  use the same restrained press feedback. The reuse palette is explicitly
  accessible. Legacy result error hosts were replaced with the approved knit.

The bounded source review found no further blocking defect after those
follow-ups. This is not visual or device sign-off. The relevant renderer,
behavioral-test, 375/390 layout, larger-text, and phone acceptance evidence
must be recorded separately. In particular, sequential native navigation
actions, keyboard changes, sheet dragging, VoiceOver speech, and save-layout
stability require checks on the actual delivery surface.

## Bounded rendered-component review

Reviewed the actual React Native components rendered through a local Expo Web
fixture, using the real fonts, material components, and Skia implementation.
The fixture mocks local API responses and routing. Its house photo and
assigned colors are test content, not extraction-quality evidence. These
captures do not establish iPhone rendering or interaction acceptance.

Evidence inspected under `/tmp/inzpo-ux-review/`:

- `saved-375.jpg` and `saved-390.jpg`: the primary **Use this kit** and explicit
  **Edit colors** actions fit in the first view. Collection and next-capture
  navigation have a quieter tier. The print/deck relationship is coherent;
  the closed deck's PRIMARY label is legible without wrapping. This is a
  substantial improvement over burying reuse below the saved illustration.
  The companion painted in the 375 frame but not the supplied 390 frame;
  character first-paint completeness is not established by that pair.
- `collection-375.jpg`: the photograph, physical color chips, title, and count
  read as one navigable saved object. The next card is visible enough to make
  the list's continuation clear. The reused material vocabulary now connects
  browsing with capture and saving.
- `reuse-375.jpg`: the sheet has a clear title, recognizable kit context,
  primary Copy action, secondary file choices, and visible copied feedback.
  One assigned cream Background chip visually disappeared into the sheet,
  making the six-role row appear incomplete. A follow-up source change gives
  filled swatches a solid stock edge while keeping empty roles dashed. That
  specific edge correction was source-verified; this screenshot predates it.
- `editor-375.jpg`: all six roles are visible, selected Primary is unambiguous,
  the preview explains the role, candidate colors and hex input are readable,
  and Save/Cancel remain anchored below the working area. The original
  discoverability and cramped-peek problems are materially improved. Still
  frames do not prove dirty-draft persistence or keyboard behavior.
- `keep-390.jpg`: title, source photo, fan, editable kit name, destination row,
  and footer fit together with clear hierarchy. The fan is expressive without
  making the name or destination disappear. This frame supports the normal
  390-width composition only.
- `keep-375.jpg` and `keep-confirmation-375.jpg`: **inconclusive, excluded from
  layout acceptance.** The first file is actually 308×667 and shows incomplete
  paint/white regions, missing form content, and a broken Save surface. The
  confirmation has broken-image glyphs and an unpainted saved action. The
  rendering run subsequently reported CanvasKit WebGL `MakeGrContext` /
  `rangeMin` errors after a fresh 375 reload. These are failures of this
  evidence path; they are not proof of an iPhone defect. They also cannot be
  described as a passing 375 Keep check.

The supplied initial Web frames also failed to paint some Back glyphs. A
later settled fixture state painted the glyph, according to the rendering
run. No native icon regression is inferred from those incomplete frames.

Two useful defects were found by exercising the real Web component path
beyond this still-frame critique: dismissing a Gorhom sheet before its first
presentation prevented the first open, and dynamically changing
`enableContentPanningGesture` replaced a wrapper and remounted the editor
draft. The refinement now avoids premature dismiss, keeps the content
wrapper stable, prevents pan-dismiss for dirty drafts, and keeps Save/Cancel
available. Browser swatch/hex editing and copying were exercised by the
implementation run; this reviewer inspected the rendered outcome and source,
not a separate native recording.

**Verdict:** the inspected saved, collection, reuse, and editor compositions
have materially better hierarchy and continuity. No additional native
shipping blocker is established by this bounded review. The cream-chip edge
was the concrete visual correction requested and is implemented in source.
Keep at 375, save confirmation stability, larger text, keyboard handling,
VoiceOver, navigation sequencing, and native gesture/motion quality remain
explicit phone acceptance work. This is a stronger candidate for that pass,
not a claim that the app has achieved Apple/Duolingo-level polish throughout.
