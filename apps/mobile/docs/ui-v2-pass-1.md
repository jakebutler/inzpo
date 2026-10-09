Inzpo UI v2, pass 1 — Designer handoff

Implemented on `cursor/inzpo-expo-scaffold`, without commits, dependency changes, native project directories, or Expo export. This pass changes Your colors and the shared button, stock, ink, film, and corner-host materials. The existing API client/reload guard, result timing/haptic budget, role editor, collection picker, and save-state persistence remain.

The baseline uses the final Round 5b CSS card seeds. The print is upright; six physical cards overlap its foot by 113pt; Edit/Save remain outside the ScrollView. Actual pin coordinates are returned by the API and mapped through the photo's top-aligned cover transform. Older kits use documented deterministic normalized points from the reference samples; a filled Surface uses (0.5, 0.6). An empty role has no pin and no invented color.

Layout evidence at default font scale (bounds include card rotation; the ~1pt stock edge is inside the reserved gap):

| Screen / safe insets | Print width × height | Pile top | Lowest rotated card bottom | Action face top | Clearance | Type size |
| --- | --- | --- | --- | --- | --- | --- |
| 390×844, 0/0 | 274×380 | 373 | 746.73 | 772 | 25.27 | 14.67 |
| 390×844, 47/34 | 274×380 | 400 | 724.13 | 746 | 21.87 | 12.72 |
| 375×667, 20/0 | 213.88×300 | 293 | 573.45 | 595 | 21.55 | 11 |
| 375×667, 24/16 | 213.88×300 | 297 | 565.54 | 587 | 21.46 | 11 |

The v7 exports retain original alpha, crop to the figure, and resize to 62pt wide at 1×/2×/3×. Runtime mirroring faces Baku inward. Idle eye discs get felt-colored eyelid overlays: close 70ms, hold 60ms, open 90ms, with a new random 4–6 second wait each time. This avoids moving the cutout silhouette/feet on each blink. Idle and success breathe over a 2.4s cycle from the bottom origin. The success cutout already has closed eyes, so it does not receive idle blink overlays. Loops cancel on blur, backgrounding, sheets/detail, unmount, and reduced motion; pose changes retain a 150ms fade.

Validation: Node 22, mobile TypeScript, all 230 Jest tests, Expo lint, all 69 mobile route Vitest tests, root TypeScript, and git diff whitespace checks. Asset and icon regeneration produces identical SHA-256 hashes. No native simulator/device screenshot was available; the layout is verified by calculations and component tests, not a claimed native pixel comparison.

Every known difference from the current spec/mocks, including preserved flows outside this pass:

1. **Native safe areas and shorter screens:** print/card positions compress around actual insets and the measured action height. The 375×667 print is 213.88×300 rather than the mock's fixed 274×380, preserving photo proportions and roughly 45% screen height. Normal card type is 14.67pt at the zero-inset baseline, 12.72pt with 47/34 insets, and 11pt on the shorter phone. Paint areas/vertical spacing shrink and the shortest cards' label stock can exceed 30% to preserve readable print. These changes are necessary for the requested two-size fold fit.
2. **Large Dynamic Type:** above 1.25× font scale the six cards use one staggered column and scroll. Their type wraps without a multiplier cap. This differs from the fixed three-column mock to avoid covering other role labels. The native header is measured too; long saved titles can expand it.
3. **Header and annotation placement:** the header occupies 86pt at default type; its film begins at y106 instead of the HTML mock's approximately y107. Back has a 36pt face in a 44pt target. The Caveat annotation is level, 17pt, with a 16pt page margin, rather than the mock SVG's inline 15px, −3° text at approximately x6. This follows the newer written size and explicit user margin. Its curve anchors to the live Primary card/pin, rather than keeping a fixed endpoint after edits.
4. **Source pin rounding and fallback:** image cover geometry uses the decoded photo dimensions instead of rounded board coordinates. On the reference 248×330 box Primary is (50.757, 146.987), Secondary (212.949, 59.189), Background (217.413, 96.720); Accent/Text displaced rings remain (17,35)/(45,21), with leaders to exact mapped samples. The written table uses 330/2000 while the CSS cover uses 248/1500, producing these fractions of a point. Missing/invalid/stale coordinates use visual fallback points, not a claim that these pixels were sampled from the user's photo. Photo failure removes pins/arrow and exposes the existing reload recovery.
5. **Live content:** photos, roles, hexes, kit titles and brief text come from the real kit, rather than hardcoding the Victorian house. Reference tints are exact; other colors get deterministic tints. Caption hue uses the Primary color name's hue word (or its full name); when unnamed, a simple sRGB hue classification supplies the word. The reference still says “This yellow.” This supports actual kits and edits.
6. **Print ink and stock texture:** text uses clean #1C1B19 rather than a glyph-clipped #1C1B19→#201F1D ink-grain bitmap. Registration marks use a small Skia print path rather than the CSS circle/lines. Card edges use the written 0.5pt stock edge rather than the mock CSS's 1px; the film retains its 1pt CSS edge. Oatmeal texture is capped at 25% opacity under text rather than multiplying the full-strength paper tile, so the measured 11.79:1 minimum survives. Filled-label worst-fiber contrast meets/exceeds 14.23:1. This favors the explicit contrast requirement and native scalable text.
7. **Button details:** button text uses bundled Geist 500 rather than the board's variable 550 weight. The enamel highlight fades out within the top 12pt rather than the CSS's first 38% of the face, preserving the measured 5.97:1 face under text. Paper/primary actions use the existing callback haptics; Save adds no press haptic to the completion budget. Enamel has the exact 2pt sink, 4→1pt lip, 4/8/12→1/2/4 shadow and #426092→#3D5988 press fill. It omits the generic scale; paper retains 0.96 and explicit shutter 0.92 is retained. Reduced motion keeps the lip/position still and fades. These follow the user's override and accessibility rule; CSS :active's 0.97 scale is not used on Save.
8. **Corner character:** width is 62pt (idle 52pt high; success 50pt high), versus the Round 5 mock's 64px host, following the explicit request. Blink lids are flat felt-colored eye overlays, not a photographed closed-eye pose. The supplied v7 knit colors are retained; the old v6 role-dye masks cannot be applied to this different silhouette, so the v7 corner host does not show the old knit dye wipe. Pending/error/empty/404 states continue to use the existing v6 sprites; no additional v7 poses were supplied. Success remains the success cutout while the kit is saved, rather than returning the saved host to idle after two seconds.
9. **Existing reveal choreography:** the preserved result sequence uses a 24pt rise/spring, start 120ms, 60ms stagger, nominal 320ms settle; its completion haptic is at 740ms, pins at 820ms, brief at 940ms with a 240ms fade. It does not implement the spec's character-owned 3D inhale/full-cheek chew/sneeze, snout Bézier flights, 420ms travel/0.18→1.05→1 scale/22° rotation, final-90ms contact shadows, or 70ms landing settle. Corner Baku is already at the action bar rather than retreating from a 3D hero. Reduced motion keeps the existing 150ms fade and single completion haptic. A tap while data is pending retains the existing behavior: it does not pre-cancel the later reveal. These existing sequence rules were explicitly preserved in this pass; the 3D character owner/assets are not implemented here.
10. **Chip detail:** the selected live card retains its pile dimensions rather than becoming the board's 110×168 study. It travels to screen center while lifting over 120ms, then flips over 420ms. Its separate back is 216pt wide and content-sized/scrollable rather than fixed 210×390; body/hex are 15/17pt rather than the board's 16/19px, and it adds accessible Close and Edit color actions. A 1.5pt grained edge is projected from the flip angle rather than a full 3D slab with an independently lit rear plane. The 16pt band, 96pt crop, actual/fallback sample dot, plain pass/fail words, reverse seating, and 150ms reduced-motion fade are implemented. The photo crop operates on the delivered photo dimensions; a resized source can cover a different physical scene area than the reference JPEG's 320×320 crop. These differences support live cards, accessible dismissal/editing and the existing signed photo asset.
11. **Edit sheet:** pin taps open the existing editor directly to that role; selected pile cards lift −6pt over 120ms and their ring scales 1.15 with red ink. Photo-pin dragging, a loupe, and exact source-pixel sampling are not implemented. Editor choices remain existing candidate swatches/hex input/clear, and its role controls remain compact pills (including dashed empty controls), not a second full card pile. This preserves the authorized working role-editing flow; source sampling needs a separate interaction implementation.
12. **Brief stock:** the brief now has the off-white grain, red rule and blue ruling, with 16pt padding and 15pt/24pt body copy, versus the result mock's 6×13px padding and 13px/19px copy. The tiny corner scuff is omitted. It remains below the fold; the larger readable treatment follows the shared brief board/accessibility needs.
13. **Keep/save and Saved compositions:** the working collection-picker Save sheet remains, including collection choices/new-name input/success feedback. It does not yet show the Keep mock's 1.34 fan, brass rivet, −3° source print or editable Akaya kit-name underline/caret. After saving, the result still shows the upright print/pile, Edit and “Snap another house”, with saved membership copy below the pile. It does not yet show the Saved mock's −1.75° dated film, closed riveted deck, “See your collection”/“Snap another” stacked actions or sensor tilt. Save does not gather cards at 80+60·i ms or punch a rivet at ~700ms; the existing success hop/haptic is preserved. Those separate Keep/Saved compositions are outside this result/material pass and remain for pass 2.
14. **Other routes:** shared buttons adopt the new paper/enamel material, but sign-in/capture and unrelated native navigation still retain their existing layouts/Baku/icon uses. Bundling all eight original Skia ink icons makes them available without adding react-native-svg; it does not replace unrelated controls in this pass.

Changed files (complete inventory follows):
- `apps/mobile/jest.setup.js` (modified).
- `apps/mobile/src/app/(app)/kit/[id].tsx` (modified).
- `apps/mobile/src/app/_layout.tsx` (modified).
- `apps/mobile/src/components/ActionButton.test.tsx` (modified).
- `apps/mobile/src/components/ActionButton.tsx` (modified).
- `apps/mobile/src/components/BriefBlock.tsx` (modified).
- `apps/mobile/src/components/EditSheet.tsx` (modified).
- `apps/mobile/src/components/RoleBands.tsx` (deleted).
- `apps/mobile/src/components/SaveButton.tsx` (modified).
- `apps/mobile/src/components/screens.test.tsx` (modified).
- `apps/mobile/src/components/startup.test.tsx` (modified).
- `apps/mobile/src/lib/contrast.test.ts` (modified).
- `apps/mobile/src/lib/usePressFeedback.ts` (modified).
- `apps/mobile/src/theme/buttons.test.ts` (modified).
- `apps/mobile/src/theme/buttons.ts` (modified).
- `apps/mobile/src/theme/tokens.ts` (modified).
- `lib/mobile-kit.ts` (modified).
- `packages/shared/src/types.ts` (modified).
- `tests/mobile-routes.test.ts` (modified).
- `apps/mobile/assets/baku-v7/crops.json` (added).
- `apps/mobile/assets/baku-v7/idle.png` (added).
- `apps/mobile/assets/baku-v7/idle@2x.png` (added).
- `apps/mobile/assets/baku-v7/idle@3x.png` (added).
- `apps/mobile/assets/baku-v7/success.png` (added).
- `apps/mobile/assets/baku-v7/success@2x.png` (added).
- `apps/mobile/assets/baku-v7/success@3x.png` (added).
- `apps/mobile/assets/fonts/Caveat.ttf` (added).
- `apps/mobile/assets/materials/color-grain.png` (added).
- `apps/mobile/assets/materials/contrast.json` (added).
- `apps/mobile/assets/materials/paper-grain.png` (added).
- `apps/mobile/docs/ui-v2-pass-1.md` (added).
- `apps/mobile/scripts/baku-v7.py` (added).
- `apps/mobile/scripts/ink-icons.py` (added).
- `apps/mobile/src/components/BackButton.tsx` (added).
- `apps/mobile/src/components/ChipDetail.tsx` (added).
- `apps/mobile/src/components/ChipPile.tsx` (added).
- `apps/mobile/src/components/CornerBaku.test.tsx` (added).
- `apps/mobile/src/components/CornerBaku.tsx` (added).
- `apps/mobile/src/components/FilmPrint.tsx` (added).
- `apps/mobile/src/components/InkIcon.tsx` (added).
- `apps/mobile/src/components/PaintChip.tsx` (added).
- `apps/mobile/src/components/PaperTexture.tsx` (added).
- `apps/mobile/src/components/PrimaryArrow.tsx` (added).
- `apps/mobile/src/lib/blink.test.ts` (added).
- `apps/mobile/src/lib/blink.ts` (added).
- `apps/mobile/src/lib/result-layout.test.ts` (added).
- `apps/mobile/src/lib/result-layout.ts` (added).
- `apps/mobile/src/lib/result-pins.test.ts` (added).
- `apps/mobile/src/lib/result-pins.ts` (added).
- `apps/mobile/src/theme/ink-icons.ts` (added).
- `apps/mobile/src/theme/materials.ts` (added).
