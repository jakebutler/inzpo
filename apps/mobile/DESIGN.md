---
name: Inzpo Mobile
description: Cream paper, photographic prints, paint-chip stock, and knitted Baku turn a photographed moment into a reusable creative kit.
colors:
  matte-blue: "#426092"
  matte-blue-edge: "#354D72"
  matte-blue-base: "#304663"
  vermilion: "#C9341F"
  paper: "#F3EEE4"
  ink: "#1C1B19"
  label-stock: "#FBF8F2"
  oatmeal-stock: "#E4D9C6"
  secondary-face: "#EAE1D2"
  secondary-edge: "#D1C5B3"
  secondary-lip: "#B8AA95"
typography:
  display:
    fontFamily: "Akaya Kanadaka"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.375
  title:
    fontFamily: "Akaya Kanadaka"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.3636363636
  body:
    fontFamily: "Geist"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4285714286
  action:
    fontFamily: "Geist"
    fontSize: "16px"
    fontWeight: 500
  field:
    fontFamily: "Geist"
    fontSize: "17px"
    fontWeight: 400
  hex:
    fontFamily: "Geist Mono"
    fontWeight: 400
rounded:
  stock: "3px"
  paper-action: "8px"
  field: "12px"
  sheet: "20px"
  matte-action: "14px"
spacing:
  fine: "4px"
  tight: "8px"
  compact: "12px"
  regular: "16px"
  group: "20px"
  page: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.matte-blue}"
    textColor: "{colors.label-stock}"
    typography: "{typography.action}"
    rounded: "{rounded.matte-action}"
    padding: "12px"
  button-secondary:
    backgroundColor: "{colors.secondary-face}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.paper-action}"
    padding: "12px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  paint-chip:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.stock}"
  paint-chip-empty:
    backgroundColor: "{colors.oatmeal-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.stock}"
  film-print:
    backgroundColor: "{colors.label-stock}"
    padding: "12px 12px 36px"
  collection-card:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.ink}"
    padding: "24px"
---

# Design System: Inzpo Mobile

## Overview

**Creative North Star: "A photographed moment becomes a usable creative kit"**

Inzpo's mobile world is a small collection of creative materials: cream paper, a photographic print, dimensional paint-chip stock, matte blue controls, and a gray knitted Baku. Akaya Kanadaka gives the interface its friendly voice; Geist makes the working information clear. Photos and their extracted colors supply the changing character of each kit.

The tactile treatment carries meaning. A print holds source evidence, a chip holds a named color, and a fan deck makes a saved kit feel like something to keep and reuse. Baku's connected wool body and actual stitched panels carry the photo-to-palette performance. Material detail belongs to those objects and should leave their labels readable.

**Key Characteristics:**

- Warm paper and dark ink form the stable interface.
- Photos and sampled colors lead the content.
- Stock, matte stock, and knit have distinct surfaces and depth.
- Expressive headings sit above plain working text and precise hex values.
- Motion connects a source photo to usable color controls.

This file records the implemented Expo mobile pilot candidate as of October 9, 2026, within `apps/mobile`. It is not native device acceptance. Source inspection, Skia renderer stills, and a bounded Expo Web fixture review establish code, character, and selected layout evidence; no Simulator or real-phone recording establishes layout, performance, or gesture approval. The current October 9 decisions in `../../PRODUCT.md` supersede the historical v4 brief. The route composition remains in `../../.impeccable/surfaces/apps-mobile-src-app.md`.

The frontmatter transcribes reusable code values. Its `px` strings are portable representations of React Native layout units, not physical pixels; text remains subject to native font scaling. The sidecar's HTML/CSS is a documentation preview of native components, not an alternate implementation or device test.

## Colors

Warm neutral materials support a restrained blue action accent. Kit colors are content and remain separate from interface tokens.

### Primary

- **Matte blue** gives primary actions their painted face. **Matte blue edge** and **matte blue base** supply the quiet dark edge and shallow material thickness.

### Secondary

- **Vermilion** marks selected source-pin rings. It does not replace the actual sampled color inside a pin.

### Neutral

- **Paper** is the page, sheet, and field ground; **ink** carries readable text and linework.
- **Label stock** is the photographic-print and populated-chip paper. It also supplies light text on matte stock actions.
- **Oatmeal stock** makes an empty color role visibly different from a populated one.
- **Secondary face**, **secondary edge**, and **secondary lip** give paper actions their own restrained depth.

**The Source Color Rule.** A kit's swatch, source-pin center, and Baku panel use the kit's actual color value. Decorative tint strips are material variations, not additional extracted colors or source evidence.

**The Honest Empty Rule.** A missing role stays empty: oatmeal chip stock and a gray Baku panel communicate the absence without inventing a swatch or sample pin.

## Typography

**Display Font:** Akaya Kanadaka, loaded as `AkayaKanadaka_400Regular`.
**Body Font:** Geist, with regular, medium, and semibold font assets.
**Label/Mono Font:** Geist Mono for hex values.

The pairing is conversational and practical. The mobile font map and root loader are authoritative; the shared `FONT_HEADING` export still names Fraunces and is not the mobile display face. Fonts load before the main interface appears, so no system-font display fallback is established here.

### Hierarchy

- **Display** is the shared screen or section heading. Result and keep screens use compact local heading variants around the same scale.
- **Title** is used for navigation and description labels.
- **Body** carries instructions, descriptions, and recoverable-error text.
- **Label** and **action** separate supporting labels from tap targets, using medium Geist.
- **Hex** uses Geist Mono; paint-chip sizes adapt to the available layout and font scale. Role labels use semibold Geist and uppercase on the physical chip face.

Caveat is loaded for the occasional handwritten date on a film print. It is a material annotation, not a second heading or body system. The tiny decorative wordmark and print code on deck chips are hidden from accessibility and are not a readable-text scale.

**The Readable Stock Rule.** Keep paint-chip role names and hex values on light stock below the painted face. Let labels grow and painted areas compress when text needs room.

## Layout

General screens use a centered, full-width content container capped at 600 units, with page padding and group spacing from the frontmatter. Result, saved, and keep compositions use a narrower content width of `min(350, viewport width - 40)` and safe-area-aware top and bottom placement. These are the current mobile layout rules, not evidence of tablet acceptance.

Results use a deliberately staggered six-chip arrangement. `src/lib/result-layout.ts` scales painted areas and spacing against the viewport and measured action/header heights. Above a font scale of 1.25 it changes the pile to one staggered column so wrapped labels have room. Saved compositions reduce their artwork footprint to leave room for actions; the keep form and expanded detail remain scrollable.

Primary actions have a minimum height of 48 units. Source pins and navigation controls reserve 44-unit targets even where the visible mark is smaller. The result footer and keep footer account for the bottom safe area. The compact header, artwork overlap, and individual chip coordinates are surface composition, not universal spacing tokens.

The 375- and 390-point phone layouts, accessibility text sizes, keyboard interaction, and actual gestures still require device verification. Do not infer approval from these formulas or from character-only renders.

## Elevation & Depth

The system uses material depth: a tight contact shadow plus a softer ambient shadow under stock, a stronger ambient shadow for lifted chips, and a shallow lower lip under matte stock or paper actions. Fine light top/left edges and darker right/bottom edges make stock thickness visible. A broad feathered sheen on the photograph and low-opacity paper texture reinforce the materials without becoming extra interface layers.

### Shadow Vocabulary

- **Resting stock**: the paired contact and ambient shadows from `src/theme/materials.ts`.
- **Lifted stock**: the same contact shadow with a deeper, broader ambient shadow for selected chips and detail faces.
- **Matte action**: a shallow soft edge and short contact shadow from `src/theme/buttons.ts`, with fine grain instead of reflective highlights.
- **Paper action**: the same press model with a quieter warm face and lip.

Exact shadow recipes and press-state values live in `.impeccable/design.json`; the native source remains authoritative for rendering.

**The Material Depth Rule.** Match depth to the object: thin stock, compressed matte stock, and soft knit have different surfaces. The lip of a matte stock control and the contact shadow of paper are material cues, not a generic shadow for every container.

## Shapes

Film prints keep square photographic geometry and a deeper paper foot. Paint chips use nearly square stock corners; secondary actions use slightly softer corners. Fields, sheets, and matte stock primary actions use their own larger radii from the frontmatter. Primary actions use 14-unit corners; paper actions use 8-unit corners.

Photo sample markers are drawn rings and leader lines, with the actual sample color at the center. Navigation icons use the local ink-path artwork. Saved and keep decks reuse the same six paint chips around a physical corner pivot and rivet. Their tilt and overlap are part of the deck composition, not permission to rotate normal text or forms.

## Components

### Buttons

`ActionButton` has two matte stock variants. The blue primary face retains its readable light label, now with fine color-grain fibers, a quiet dark edge, and 14-unit corners. Warm secondary paper uses 8-unit corners, paper fibers, and a muted edge. Both use clipped existing texture assets, with no gradient sheen or reflective inset bevel. Labels remain in medium Geist, and the 48-unit minimum grows with text.

Two short contact shadows replace the tall hard lip and broad floating shadow. Pressing sinks the face two units, darkens it slightly, and compresses the contact shadow; the face stays full-width by default. The camera's explicit shutter scale remains. Reduced Motion uses nonspatial feedback with resting shadow geometry. Disabled controls remove depth. Back uses the same matte paper face inside its existing 44-unit target. `SaveButton` reuses the primary treatment and preserves its saving/saved check transition.

### Chips

`PaintChip` combines a color face, a narrow three-part tint strip, and a readable stock label. Empty roles use oatmeal stock and explain that a color can be added. The tint strip is a visual treatment; only the role's assigned hex is the kit token.

`ChipPile` makes those same objects interactive. A populated chip opens its detail face; an empty role opens editing. Selection raises the chip and increases its stock shadow. `ChipDetail` presents the hex, source explanation, and a real source crop when available. Visible Edit color and Copy hex actions make the next step discoverable; touch-and-hold and the accessibility edit action remain. Text readability compares Text with Background, never Text with itself. These gesture implementations still need device review.

### Cards / Containers

`FilmPrint` frames the real source photograph with label stock, a larger lower margin, and restrained photographic sheen. Source rings are drawn only for actual samples. Each pin carries a 44-unit edit target. A failed image uses an explicit placeholder/recovery state.

`SavedKit` combines a larger print with a closed `KitDeck`; `KeepScreen` uses the open fan while naming and choosing a collection. Both reuse `PaintChip`, including empty roles. Collection detail cards combine the actual photograph, six small paint chips, a title, and a truthful populated-color count. A failed photo leaves the colors usable in a stable placeholder. The collection index uses folder-tab stock with only its available name/count data. Both retain existing content during refresh failures.

### Inputs / Fields

Shared fields use paper, a dark one-unit outline, the field radius, and regular Geist. The hex editor accepts six hex digits, updates its live draft preview as a valid value is entered, and waits until blur or submit before showing validation errors. The keep-name field is a local exception: an Akaya heading with a hand-drawn underline, not the default treatment for all inputs.

`EditSheet` uses a paper bottom sheet, dark grabber, and dimmed ink backdrop when expanded. Role choices and candidate swatches wrap, selected choices have a visible stroke, and empty choices have a dashed outline. The sheet opens expanded; Save and Cancel remain anchored while its contents scroll, including at the shorter snap point. Dirty edits require explicit discard and cannot be lost through backdrop/pan-down dismissal. Validation and saving state control the action's disabled state. Keep waits for destinations, defaults to an existing collection, and holds its form/artwork geometry while the fan gathers into a saved deck.

### Navigation

The native stack uses a paper header, dark ink, an Akaya title, and no header shadow. Custom back controls have a round paper face inside a larger tap target. Navigation and utility actions retain accessible labels even when their ink-path artwork is the visible affordance. Back preserves collection context; completing Keep clears the capture/Keep stack before opening the saved result. The native stack uses a short fade under Reduced Motion.

### Baku performance

`src/baku/KnitBaku.tsx`, its shader, and the six runtime WebP assets implement the approved connected knitted character. Preserve wool fibers, stitched-panel boundaries, eye registration, and the left-facing three-quarter identity. The `mobilePort` section of `assets/baku-performance/provenance.json` records all six runtime WebPs, source-study hashes, and their material-map or fallback derivations.

The current performance starts gray, fills actual stitched panels from the kit, chews, anticipates, and sneezes. `ColorInhale` draws repeated tapered ribbons from measured source-photo samples into the moving nostril. `transport.ts` launches color chips along the nostril axis before they fan into the existing controls, following study `bb16e1e`. Empty roles arrive as blank stock rather than flying invented color.

Selecting a photo opens Your colors immediately. The in-memory capture session uploads and creates the kit on that same route; the photograph and Baku stay mounted throughout. During upload, his snout opens gently and warm paper dust curls from the lower-left photo edge into its moving tip. The extraction callback blends into chewing over 0.32s. A slow response keeps the gray chew looping; actual samples then get their own inhale before coat fill and a full-chew-boundary sneeze. No upload screen or route handoff interrupts the performance.

After the final swatch launches, Baku deflates and follows a capture-seeded winding flight to the lower-left corner. The same colored knit mesh remains there; no mascot replacement marks the endpoint. Flight takes 1.75s, starting 0.31s after sneeze onset. Translation, rotation and scale happen on the UI thread. The clock waits for displayed photo and loaded art, pauses when unfocused/backgrounded or failed, and scroll stays still during the performance. Retry retains the photo and does not reopen the picker. Show my colors skips to the settled corner once the palette is ready. Reduced Motion keeps the waiting host still, omits dust and flight, and exposes the result with the existing short fade.

The mesh uses default source-over paint; destination-only paint makes it invisible on a clear canvas. CanvasKit scene-graph frames and compiled-worklet tests cover the implementation, not iPhone frame rate or native gesture acceptance. The earlier scored renderer review in `../../docs/ux/2026-10-09-native-renderer-review.md` does not establish approval of this new phone sequence.

### Kit tools

`UseKitSheet` makes reuse the primary action on a saved kit, with editing directly available below. Reopening skips the extraction entrance delay. The sheet summarizes six roles accessibly; populated light swatches retain solid stock edges, while absent roles stay dashed. `KitTools` labels the current operation, confirms clipboard success with Copied, and distinguishes pending descriptions, failed descriptions, and copy/export errors. Dismissing a native share sheet does not claim delivery. Temporary export files are cleaned up.

`PaperPressable` gives stock cards, the saved deck, and color choices a restrained press response with one light haptic. Reduced Motion substitutes opacity for spatial movement. `KnitCompanion` and `CollectionState` use the approved knit identity for saved, empty, and error states. No additional raster asset was introduced.

## Do's and Don'ts

### Do:

- **Do** preserve cream paper, photographic prints, paint-chip stock, matte blue actions, and Baku's knit as distinct materials.
- **Do** use actual kit colors for swatches, sample markers, and Baku panels; keep empty roles visibly empty.
- **Do** keep readable chip labels on stock and accommodate font scaling with layout growth.
- **Do** reuse the same paint-chip component in the interactive pile, saved deck, and keep fan.
- **Do** preserve the explicit skip, Reduced Motion result path, and background pause.
- **Do** treat phone layout, text scaling, performance, and gestures as pending until verified on the target device.

### Don't:

- **Don't** promote decorative tint strips into extracted colors or source evidence.
- **Don't** turn one screen's overlap, tilt, or artwork measurements into a universal layout rule.
- **Don't** substitute the shared Fraunces export for the mobile Akaya display font.
- **Don't** use sidecar previews or Skia character stills as proof of native phone acceptance.

Deliberately not canonized: legacy mini-Baku assets and their animation vocabulary, old web-only restrictions, the unused shared Fraunces display designation, and tiny decorative print as a readable type scale. They do not establish new mobile design rules. Existing legacy elements are not evidence that the approved knit performance should change identity.

Source anchors: `src/theme/{tokens,materials,buttons,styles,motion}.ts`; `src/app/_layout.tsx`; `src/lib/result-layout.ts`; `src/components/{ActionButton,FilmPrint,PaintChip,SavedKit,KitDeck,KitTools,KeepScreen,EditSheet,MotionSheet,BackButton}.tsx`; `src/baku/{KnitBaku,ColorInhale,DustIntake,FlyingBaku}.tsx`; `src/baku/{motion,transport,host-motion,usePalettePerformance}.ts`.


### Rest-of-app review evidence

The October 9 senior UX critique and bounded correction pass are in `../../docs/ux/2026-10-09-mobile-rest-of-app-critique.md`. Expo Web fixtures imported the shipping native components with a mocked API/router and checked saved layouts at 375/390 widths, plus reuse, editing and collections at 375. They exposed and corrected first-open modal lifecycle and draft-remount bugs. Keep at 375 and save confirmation were inconclusive because CanvasKit WebGL surfaces failed to paint; these are not native screenshots or native defects established by evidence. Phone acceptance still covers Keep, keyboard/dragging, larger text, VoiceOver, navigation and motion feel.

The October 9 matte-button refinement follows the phone report that buttons were too shiny. The bounded material preview is generated from shipping surface tokens; it is not a native screenshot. No new raster assets or dependencies were added. Native appearance remains part of the Expo Go phone pass.
