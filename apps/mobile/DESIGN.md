---
name: Inzpo Mobile
description: Cream paper, photographic prints, paint-chip stock, and knitted Baku turn a photographed moment into a reusable creative kit.
colors:
  sky-enamel: "#426092"
  enamel-rim: "#7E93B5"
  enamel-lip: "#2D4163"
  vermilion: "#C9341F"
  paper: "#F3EEE4"
  ink: "#1C1B19"
  label-stock: "#FBF8F2"
  oatmeal-stock: "#E4D9C6"
  secondary-face: "#F7F1E6"
  secondary-edge: "#FFFDF8"
  secondary-lip: "#C5BBAB"
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
  paper-action: "5px"
  field: "12px"
  sheet: "20px"
  enamel-action: "24px"
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
    backgroundColor: "{colors.sky-enamel}"
    textColor: "{colors.label-stock}"
    typography: "{typography.action}"
    rounded: "{rounded.enamel-action}"
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

Inzpo's mobile world is a small collection of creative materials: cream paper, a photographic print, dimensional paint-chip stock, blue enamel controls, and a gray knitted Baku. Akaya Kanadaka gives the interface its friendly voice; Geist makes the working information clear. Photos and their extracted colors supply the changing character of each kit.

The tactile treatment carries meaning. A print holds source evidence, a chip holds a named color, and a fan deck makes a saved kit feel like something to keep and reuse. Baku's connected wool body and actual stitched panels carry the photo-to-palette performance. Material detail belongs to those objects and should leave their labels readable.

**Key Characteristics:**

- Warm paper and dark ink form the stable interface.
- Photos and sampled colors lead the content.
- Stock, enamel, and knit have distinct surfaces and depth.
- Expressive headings sit above plain working text and precise hex values.
- Motion connects a source photo to usable color controls.

This file records the implemented Expo mobile pilot candidate as of October 9, 2026, within `apps/mobile`. It is not native device acceptance. Source inspection and real Skia renderer stills establish code and rendered character evidence; no Simulator or real-phone recording establishes layout, performance, or gesture approval. The current October 9 decisions in `../../PRODUCT.md` supersede the historical v4 brief. The route composition remains in `../../.impeccable/surfaces/apps-mobile-src-app.md`.

The frontmatter transcribes reusable code values. Its `px` strings are portable representations of React Native layout units, not physical pixels; text remains subject to native font scaling. The sidecar's HTML/CSS is a documentation preview of native components, not an alternate implementation or device test.

## Colors

Warm neutral materials support a restrained blue action accent. Kit colors are content and remain separate from interface tokens.

### Primary

- **Sky enamel** gives primary actions their painted face. **Enamel rim** and **enamel lip** supply the light edge and lower material thickness.

### Secondary

- **Vermilion** marks selected source-pin rings. It does not replace the actual sampled color inside a pin.

### Neutral

- **Paper** is the page, sheet, and field ground; **ink** carries readable text and linework.
- **Label stock** is the photographic-print and populated-chip paper. It also supplies light text on enamel actions.
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

The system uses material depth: a tight contact shadow plus a softer ambient shadow under stock, a stronger ambient shadow for lifted chips, and a shallow lower lip under enamel or paper actions. Fine light top/left edges and darker right/bottom edges make stock thickness visible. A broad feathered sheen on the photograph and low-opacity paper texture reinforce the materials without becoming extra interface layers.

### Shadow Vocabulary

- **Resting stock**: the paired contact and ambient shadows from `src/theme/materials.ts`.
- **Lifted stock**: the same contact shadow with a deeper, broader ambient shadow for selected chips and detail faces.
- **Enamel action**: a lower material lip, ambient shadow, and subtle inner highlights from `src/theme/buttons.ts`.
- **Paper action**: the same press model with a quieter warm face and lip.

Exact shadow recipes and press-state values live in `.impeccable/design.json`; the native source remains authoritative for rendering.

**The Material Depth Rule.** Match depth to the object: thin stock, compressed enamel, and soft knit have different surfaces. The lip of an enamel control and the contact shadow of paper are material cues, not a generic shadow for every container.

## Shapes

Film prints keep square photographic geometry and a deeper paper foot. Paint chips use nearly square stock corners; secondary actions use slightly softer corners. Fields, sheets, and enamel primary actions use their own larger radii from the frontmatter. Do not apply the enamel capsule shape to printed materials.

Photo sample markers are drawn rings and leader lines, with the actual sample color at the center. Navigation icons use the local ink-path artwork. Saved and keep decks reuse the same six paint chips around a physical corner pivot and rivet. Their tilt and overlap are part of the deck composition, not permission to rotate normal text or forms.

## Components

### Buttons

`ActionButton` is a tactile control with two material variants. Primary enamel uses a rounded face, rim, lower lip, and light label. Secondary paper uses a small corner radius, warm face, dark label, and paper texture. Both keep the action label in medium Geist and grow beyond their minimum height when needed.

Pressing compresses the material lip and slightly darkens the face. Reduced Motion removes physical translation and uses nonspatial feedback. Disabled controls remove their shadows and expose the disabled accessibility state. `SaveButton` reuses the primary material, changes its label to Saving or Saved, and reveals a check with a fade under Reduced Motion. Native hover or custom keyboard-focus styling is not established by these components.

### Chips

`PaintChip` combines a color face, a narrow three-part tint strip, and a readable stock label. Empty roles use oatmeal stock and explain that a color can be added. The tint strip is a visual treatment; only the role's assigned hex is the kit token.

`ChipPile` makes those same objects interactive. A populated chip opens its detail face; an empty role opens editing. Selection raises the chip and increases its stock shadow. `ChipDetail` presents the hex, source explanation, and a real source crop when available; touch-and-hold and an accessibility action lead to editing. These gesture implementations still need device review.

### Cards / Containers

`FilmPrint` frames the real source photograph with label stock, a larger lower margin, and restrained photographic sheen. Source rings are drawn only for actual samples. Each pin carries a 44-unit edit target. A failed image uses an explicit placeholder/recovery state.

`SavedKit` combines a larger print with a closed `KitDeck`; `KeepScreen` uses the open fan while naming and choosing a collection. Both reuse `PaintChip`, including empty roles. Collection list cards use stock material and generous internal padding; they are plain navigable containers rather than another chip shape.

### Inputs / Fields

Shared fields use paper, a dark one-unit outline, the field radius, and regular Geist. The hex editor shows a textual validation error for anything other than six hex digits. The keep-name field is a local exception: an Akaya heading with a hand-drawn underline, not the default treatment for all inputs.

`EditSheet` uses a paper bottom sheet, dark grabber, and dimmed ink backdrop when expanded. Role choices and candidate swatches wrap, selected choices have a visible stroke, and empty choices have a dashed outline. Validation and saving state control the action's disabled state.

### Navigation

The native stack uses a paper header, dark ink, an Akaya title, and no header shadow. Custom back controls have a round paper face inside a larger tap target. Navigation and utility actions retain accessible labels even when their ink-path artwork is the visible affordance.

### Baku performance

`src/baku/KnitBaku.tsx`, its shader, and the six runtime WebP assets implement the approved connected knitted character. Preserve wool fibers, stitched-panel boundaries, eye registration, and the left-facing three-quarter identity. The `mobilePort` section of `assets/baku-performance/provenance.json` records all six runtime WebPs, source-study hashes, and their material-map or fallback derivations.

The current performance starts gray, fills actual stitched panels from the kit, chews, anticipates, and sneezes. `ColorInhale` draws repeated tapered ribbons from measured source-photo samples into the moving nostril. `transport.ts` launches color chips along the nostril axis before they fan into the existing controls, following study `bb16e1e`. Empty roles arrive as blank stock rather than flying invented color.

The performance clock waits for loaded art and the displayed source photo, pauses when the app is backgrounded or the route loses focus, and finishes at a whole chew boundary. The explicit Show my colors action skips the performance once the palette is ready. Reduced Motion exposes the result without the performance. Exact timing stays in the sidecar and source; no native frame-rate or gesture claim follows from those values. The ship verdict in `../../docs/ux/2026-10-09-native-renderer-review.md` covers the scored renderer/transport correction only, not the phone surface.

### Kit tools

`KitTools` uses the established secondary actions for Copy kit, Export CSS, and Export JSON. Plain text reports completion or failure. The description remains independent of palette readiness; its waiting or failed state does not require a different button system.

## Do's and Don'ts

### Do:

- **Do** preserve cream paper, photographic prints, paint-chip stock, blue enamel actions, and Baku's knit as distinct materials.
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

Source anchors: `src/theme/{tokens,materials,buttons,styles,motion}.ts`; `src/app/_layout.tsx`; `src/lib/result-layout.ts`; `src/components/{ActionButton,FilmPrint,PaintChip,SavedKit,KitDeck,KitTools,KeepScreen,EditSheet,MotionSheet,BackButton}.tsx`; `src/baku/{KnitBaku,ColorInhale}.tsx`; `src/baku/{motion,transport,usePalettePerformance}.ts`.
