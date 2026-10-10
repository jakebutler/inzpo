Inzpo UI v2, pass 2 — implementation and visual audit

Completed on `cursor/inzpo-expo-scaffold`, without a commit, dependency changes, Expo export, or online documentation/build calls. Node 22 was used. Pass 1's uncommitted work remains in place. This document supersedes the outstanding Keep/Saved/chip-detail descriptions in the historical pass 1 handoff.

Keep now shows six physical cards in the 1.34-scale corner-riveted fan, a 145×167 print with 7pt margins and 23pt foot at −3°, an editable 32pt Akaya collection-name field with a Skia underline under its final line, and paper/enamel Not now / Save kit actions. Existing collection loading, selection, new-name trimming, in-flight guard, error copy, single Success/Error haptic, and automatic dismissal at 900ms remain. The sheet receives the live kit instead of refetching it.

Saved now shows the title, “Saved. It’s in the collection.”, a 350×380 print at the 390pt baseline, 330pt photo, Caveat date, closed six-card riveted deck and a −1.75° composition. The collection and Snap buttons stack at x96, with a 12pt gap and bottom 26pt; the 64pt v7 Success host at x16 has exactly 16pt horizontal clearance. Your colors remains upright. The closed deck still opens the existing editor.

A filled chip opens one detail layer. It lifts −6pt/scales 1.04 for 120ms, then rotates Y through 180° for 420ms with perspective 900 and hidden backfaces. Tap or a downward gesture returns it in reverse order. Only one role owns the layer. The back uses 210×390 stock, a 16pt band, 19pt Geist Mono hex, 16pt/24pt Geist copy, and a centered 96pt crop of 320 source pixels. The role sample/fallback is shared with the print pins. Readability compares the kit's actual Text role with that chip at 4.5:1; each role uses the same naming rules as the Primary arrow. A missing Text role has recovery copy. Reduced motion crossfades both faces for 150ms with no lift, scale animation or rotation. Hidden faces cannot be read; the chip exposes expanded state and announces its back content.

`GET /api/mobile/collections/[id]` requires the mobile bearer owner, finds the collection through existing collection helpers, queries owned ready photo/screenshot items, rechecks each detail, and returns `{ id, name, kits: [{ id, title, roles, photo: { url } | null }] }`. Photos use existing 15-minute signed URLs. The shared client exposes `getCollection(id)`. The collection screen is read-only, with loading, empty, error/retry, photos, titles, role summaries and Back.

Validation: mobile `npx tsc --noEmit`, `npx jest --maxWorkers=2` (247 tests in 26 suites), and `npx expo lint`; root `npx vitest run tests/mobile-routes.test.ts` (75 tests), `npx tsc --noEmit`, and `git diff --check`. The shared client Vitest suite also passed (16 tests). Verification used offline/telemetry-disabled command settings. No native device/simulator rendering was available, so this is a code/component/layout audit, not a claim of pixel-identical native screenshots.

Every identified difference from VISUAL-V2.md and the three supplied current mocks, with its reason:

1. Live content replaces the fixture: photo, palette, role availability, title, hue names and brief come from the API. Reference tints are exact; other painted colors use the existing deterministic tint generator. Missing photos and failed loads retain recovery UI. These differences make the layout work for real kits. The date is the device's current day/month, rather than hardcoded “8 Oct” or a persisted capture/save date; the current MobileKit DTO has no timestamp.
2. Keep's prominent name field names a **new collection**, rather than renaming the kit as the mock implies. It starts empty, using the kit title as its placeholder, and Save kit is disabled at 40% opacity until an existing collection is selected or a nonblank new name is entered. The New collection label, chooser instructions, kit counts, radio rows, loading/empty/retry/error messages and post-save “Its colors have a home.” / Saved / Done feedback are additional UI absent from mock-keep.png. This preserves the explicitly requested collection/save logic; no kit-renaming endpoint or behavior was introduced.
3. Keep is a full-height Gorhom modal with its existing 20pt rounded upper corners, keyboard behavior, autofocus, pan-down dismissal and write-time dismissal guard, rather than a flat HTML screen. It has no grabber. The initial keyboard can move/scroll the name field into view, unlike the keyboard-free still mock. The native cursor replaces the always-visible mock caret. The name is 32pt with unlimited Dynamic Type; native text measurement controls one underline under the last wrapped line. The hint uses the existing Geist font with native italic styling, rather than a separately bundled Geist Italic face. These preserve keyboard/editing behavior and reuse the existing fonts.
4. Native layout follows safe insets and flowing text instead of fixed 390×844 CSS coordinates. At zero insets/default type, Keep's header block ends around y120, its source print is at y430, and its field label adds about 14pt before the editable name. The field/hint use native line boxes rather than the mock's absolute y614/y667 positioning. Saved's header/summary place its film around y203 rather than the mock's roughly y201. Saved photo height scales with width below 350pt; it retains 330pt on the baseline. On short screens or with long/large titles the content scrolls behind fixed actions; it is not all forced onto one screen. This prevents clipped text and respects real device bounds.
5. Saved retains the brief and brief-retry action below the composition, although mock-saved.png ends at the actions. The closed deck is an accessible Edit button, preserving the previous saved-kit editing flow without adding another visible action. Collection membership is announced with the collection name; visible copy remains the exact mock sentence. These retain existing result behavior.
6. Detail uses the tapped live pile card's dimensions and resting rotation, rather than always using the board's 110×168 Primary study. It also travels to screen center during the 120ms lift, then reverses to the recorded scroll position on return. The 210×390 back scales up to 1.3× in width for Dynamic Type, increases its height subject to screen bounds, and scrolls. The board uses fixed positions and dimensions. This keeps live chips recognizable and makes the back readable at accessibility sizes.
7. The detail layer adds a custom Close icon/44pt target, backdrop dismissal, a long-press Edit action, an accessibility Edit action, and no-photo/failed-photo/missing-Text recovery copy. An empty role still opens the editor directly instead of inventing a colored back or hex. The crop centers the actual or shared fallback pin in the delivered image using the DTO's source dimensions; small/edge samples can expose stock beyond the photo boundary rather than moving the center. These preserve editing/dismissal and honest sample geometry. Normal taps on the back still flip it back.
8. The lifted contact/ambient shadow is selected immediately rather than tweening shadow spread over the 120ms lift. The 1.5pt edge is a grained projected strip based on sin/cos of the angle, not a complete independently lit 3D slab/rear stock plane or the board's separate 3× explanatory inset. This uses the installed Reanimated/Skia view rendering without new native dependencies; the 900pt perspective and front/back hiding are implemented.
9. Keep/Saved use native Skia radial gradients for rivets: the outer gradient radius is 0.85×size and the center radius is 0.17×size, rather than CSS's default radial extent and inset 5/7px center geometry; the CSS inset white shadow is not reproduced. The pivot, 17pt Keep / 23pt closed-deck base sizes, brass colors, top-left illumination and cast shadow are retained. This is the native vector material approximation. Card label bottoms use native text-derived minimum height; they can exceed the nominal 30% stock area when needed to avoid clipping. There is no sensor tilt; it is optional in the spec, and the Result stays still.
10. Inherited Result adaptation remains: print/card positions compress around insets and measured action/header height. For 390×844 with 47/34 insets the pile type is about 12.72pt; shorter phones preserve an 11pt minimum and shrink paint/spacing. Above 1.25× Dynamic Type, cards use a staggered single column and scroll instead of the fixed three-column mock. The shortest labels can occupy more than 30% of a card. This is pass 1's readability/fold-fit behavior, retained here.
11. Inherited Result header/arrow/pins remain: a 36pt Back face uses a 44pt target; the heading is 30pt/32pt. The Caveat caption is level at 17pt with a 16pt page margin, rather than the mock SVG's −3° annotation near x6. Its curve anchors to the live Primary pin. Source cover geometry gives reference Primary (50.757,146.987), Secondary (212.949,59.189), Background (217.413,96.720), instead of the spec's rounded 330/2000 table. Accent/Text retain displaced (17,35)/(45,21) rings and exact-source leaders. Missing/invalid/stale coordinates use the documented reference fallback; filled Surface uses (0.5,0.6). Empty roles have no pin. These retain the current cover transform and existing live-kit fallback contract.
12. Inherited materials remain: text is clean #1C1B19 rather than glyph-clipped ink grain through #201F1D; registration marks are the existing Skia print paths. Card edges are 0.5pt per the written spec rather than the mock CSS's 1px; film edges are 1pt. Oatmeal texture stays at 25% under print to meet measured contrast. Film sheen is the existing fixed Skia feathered ellipse/top glint instead of browser gradient compositing. Paper/color grain bitmaps are reused. These preserve native scalable text, measured contrast and Expo Go compatibility.
13. Inherited buttons remain: Geist 500 replaces the board's variable 550 weight. The enamel top highlight fades in 12pt rather than 38% of the face; it keeps the measured label contrast. Enamel uses the 2pt sink, 4→1pt lip, 4/8/12→1/2/4 shadow and 7% darkening, and does not use CSS's generic 0.97 active scale. Paper retains the existing 0.96 press scale. Reduced motion keeps physical position/lip still and fades. These are pass 1's button/accessibility decisions, used by all new actions.
14. Corner Baku on Keep and Saved is now 64pt wide, as in Round 5, by scaling the existing 62pt v7 alpha assets; Your colors remains 62pt per pass 1. The resulting contact/ambient shadows scale with the cutout. Idle eyelids are felt-colored native eye overlays instead of a photographed blink pose. The v7 knit colors are fixed, with no old v6 role-dye wipe on that silhouette. Pending/error/empty/404 states still use v6 assets because no corresponding v7 poses were supplied. Saved stays in Success, while the Keep sheet's existing success-hold timer can return to Idle after 2s (normally it has dismissed at 900ms). These preserve supplied assets and existing pose logic.
15. The existing extraction/reveal choreography is still different: 24pt rise/spring, 120ms start, 60ms stagger, nominal 320ms settle, completion haptic at 740ms, pins at 820ms, brief at 940ms with 240ms fade. It does not implement the character-owned 3D inhale/full-cheek chew/sneeze, snout Bézier flights, 420ms flight/0.18→1.05→1 scale/22° rotation, last-90ms contact shadows, 70ms landing settle, 180ms dye wipes or 600ms retreat. A tap during unfinished extraction does not pre-cancel the later reveal. Save displays the completed fan and retains the existing success hop/haptic rather than gathering cards at 80+60·i ms and punching the rivet around 700ms. These are the preserved pass 1 extraction/Save sequences; the character-owned 3D assets/choreography are not provided by this pass. Reduced motion still uses its existing fades and single completion haptic.
16. The inherited editor still uses candidate swatches, hex input and Clear, including compact/dashed empty role controls. Pin dragging, a loupe and source-pixel sampling are absent. The brief retains 16pt padding and 15pt/24pt text rather than the Result mock's 6×13 padding and 13px/19px text; its tiny corner scuff is omitted. These preserve the existing editor and shared readable brief material. Shared buttons also affect sign-in/Snap, but their screen composition, older Baku and unrelated controls remain unchanged. The new collection route is intentionally a minimal read-only list because there is no mobile collection design in these mocks.

Files changed by pass 2 (including pass 1 files extended in this pass):

- `app/api/mobile/collections/[id]/route.ts`
- `apps/mobile/docs/ui-v2-pass-2.md`
- `apps/mobile/jest.setup.js`
- `apps/mobile/src/app/(app)/collection/[id].tsx`
- `apps/mobile/src/app/(app)/kit/[id].tsx`
- `apps/mobile/src/components/BackButton.tsx`
- `apps/mobile/src/components/ChipDetail.test.tsx`
- `apps/mobile/src/components/ChipDetail.tsx`
- `apps/mobile/src/components/ChipPile.tsx`
- `apps/mobile/src/components/CornerBaku.tsx`
- `apps/mobile/src/components/FilmPrint.tsx`
- `apps/mobile/src/components/KitDeck.tsx`
- `apps/mobile/src/components/PaintChip.tsx`
- `apps/mobile/src/components/SaveButton.tsx`
- `apps/mobile/src/components/SaveSheet.tsx`
- `apps/mobile/src/components/SaveSheetContent.test.tsx`
- `apps/mobile/src/components/SaveSheetContent.tsx`
- `apps/mobile/src/components/SavedKit.tsx`
- `apps/mobile/src/components/collection.test.tsx`
- `apps/mobile/src/components/screens.test.tsx`
- `apps/mobile/src/components/sheets.test.tsx`
- `apps/mobile/src/lib/chip-flip.test.ts`
- `apps/mobile/src/lib/chip-flip.ts`
- `apps/mobile/src/lib/result-pins.ts`
- `apps/mobile/tests/fixtures.ts`
- `packages/shared/src/api.ts`
- `packages/shared/src/types.ts`
- `tests/mobile-routes.test.ts`
- `tests/shared-api.test.ts`

Complete uncommitted working-tree inventory, including preserved pass 1 files:

- `apps/mobile/jest.setup.js` (M)
- `apps/mobile/src/app/(app)/kit/[id].tsx` (M)
- `apps/mobile/src/app/_layout.tsx` (M)
- `apps/mobile/src/components/ActionButton.test.tsx` (M)
- `apps/mobile/src/components/ActionButton.tsx` (M)
- `apps/mobile/src/components/BriefBlock.tsx` (M)
- `apps/mobile/src/components/EditSheet.tsx` (M)
- `apps/mobile/src/components/RoleBands.tsx` (D)
- `apps/mobile/src/components/SaveButton.tsx` (M)
- `apps/mobile/src/components/SaveSheet.tsx` (M)
- `apps/mobile/src/components/SaveSheetContent.test.tsx` (M)
- `apps/mobile/src/components/SaveSheetContent.tsx` (M)
- `apps/mobile/src/components/screens.test.tsx` (M)
- `apps/mobile/src/components/sheets.test.tsx` (M)
- `apps/mobile/src/components/startup.test.tsx` (M)
- `apps/mobile/src/lib/contrast.test.ts` (M)
- `apps/mobile/src/lib/usePressFeedback.ts` (M)
- `apps/mobile/src/theme/buttons.test.ts` (M)
- `apps/mobile/src/theme/buttons.ts` (M)
- `apps/mobile/src/theme/tokens.ts` (M)
- `apps/mobile/tests/fixtures.ts` (M)
- `lib/mobile-kit.ts` (M)
- `packages/shared/src/api.ts` (M)
- `packages/shared/src/types.ts` (M)
- `tests/mobile-routes.test.ts` (M)
- `tests/shared-api.test.ts` (M)
- `app/api/mobile/collections/[id]/route.ts` (??)
- `apps/mobile/assets/baku-v7/crops.json` (??)
- `apps/mobile/assets/baku-v7/idle.png` (??)
- `apps/mobile/assets/baku-v7/idle@2x.png` (??)
- `apps/mobile/assets/baku-v7/idle@3x.png` (??)
- `apps/mobile/assets/baku-v7/success.png` (??)
- `apps/mobile/assets/baku-v7/success@2x.png` (??)
- `apps/mobile/assets/baku-v7/success@3x.png` (??)
- `apps/mobile/assets/fonts/Caveat.ttf` (??)
- `apps/mobile/assets/materials/color-grain.png` (??)
- `apps/mobile/assets/materials/contrast.json` (??)
- `apps/mobile/assets/materials/paper-grain.png` (??)
- `apps/mobile/docs/ui-v2-pass-1.md` (??)
- `apps/mobile/docs/ui-v2-pass-2.md` (??)
- `apps/mobile/scripts/baku-v7.py` (??)
- `apps/mobile/scripts/ink-icons.py` (??)
- `apps/mobile/src/app/(app)/collection/[id].tsx` (??)
- `apps/mobile/src/components/BackButton.tsx` (??)
- `apps/mobile/src/components/ChipDetail.test.tsx` (??)
- `apps/mobile/src/components/ChipDetail.tsx` (??)
- `apps/mobile/src/components/ChipPile.tsx` (??)
- `apps/mobile/src/components/CornerBaku.test.tsx` (??)
- `apps/mobile/src/components/CornerBaku.tsx` (??)
- `apps/mobile/src/components/FilmPrint.tsx` (??)
- `apps/mobile/src/components/InkIcon.tsx` (??)
- `apps/mobile/src/components/KitDeck.tsx` (??)
- `apps/mobile/src/components/PaintChip.tsx` (??)
- `apps/mobile/src/components/PaperTexture.tsx` (??)
- `apps/mobile/src/components/PrimaryArrow.tsx` (??)
- `apps/mobile/src/components/SavedKit.tsx` (??)
- `apps/mobile/src/components/collection.test.tsx` (??)
- `apps/mobile/src/lib/blink.test.ts` (??)
- `apps/mobile/src/lib/blink.ts` (??)
- `apps/mobile/src/lib/chip-flip.test.ts` (??)
- `apps/mobile/src/lib/chip-flip.ts` (??)
- `apps/mobile/src/lib/result-layout.test.ts` (??)
- `apps/mobile/src/lib/result-layout.ts` (??)
- `apps/mobile/src/lib/result-pins.test.ts` (??)
- `apps/mobile/src/lib/result-pins.ts` (??)
- `apps/mobile/src/theme/ink-icons.ts` (??)
- `apps/mobile/src/theme/materials.ts` (??)
