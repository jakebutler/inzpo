# Brand continuity review — October 9, 2026

The phone review accepted forest mist and asked for a broader pass on lifeless,
washed-out or inconsistent moments. This pass carries the approved material
language into the working screens without adding another hero sequence.

| Finding | Change |
| --- | --- |
| Collection index was a repeated flat name/count card. | Warm folders with thin manila backing and small matte blue tabs holding actual kit counts. No invented palette or photo preview. |
| Expanded editor initially selected no role, leaving much of its working area empty. | Open the requested role or first populated role, falling back to Primary. Initialize the visible draft without dirtying it or enabling Save. |
| Small flat color rectangles lost cream colors and their role labels. | StockSwatch frames real paint and keeps labels on cream. Empty roles remain unpainted oatmeal with a dashed edge and blank mark. |
| Reuse felt detached from the kit just opened. | Actual thumbnail and Akaya kit name lead into the same six labeled stock swatches. Copy remains first. Thumbnail failure does not block tools. |
| Description waiting/failure replaced the physical card with loose status content. | Photo notes persist as the same warm card through pending, failed and ready states, with honest copy and the approved knit host. |
| Collection empty/loading screens had competing headlines and empty-count copy. | One clear empty/loading message; no premature zero-ideas announcement. |
| An unsaved result fallback still used the older mascot. | Approved knitted companion with actual kit colors in the result corner. |

Capture, upload, dust intake, chewing, sneeze, balloon flight, matte action
buttons and the shared 8-unit button radius remain the accepted baseline.

## Independent critique and bounded revision

The senior UX reviewer assessed source and the final static studies. Two
material issues were corrected: collection count tabs now participate in
layout so scaled text cannot be clipped by a fixed overlap; the unsaved
fallback Baku uses a 72-unit host at left 10, ending before the Edit control.
Long collection names wrap in the study. The final review found no further
material blocker in these views; that verdict is limited to source and static
material rendering.

## Verification

- Native lint and typecheck pass.
- Final targeted run: 101 tests in seven suites pass (screens, sheets,
  collection behavior, photo-note continuity, reuse tools, buttons, contrast).
- New regressions verify first-populated-role initialization without a dirty
  draft and persistence of the same photo-note card across status changes.
- The preceding broad run passed four compiled-worklet checks and 390 of 391
  Jest cases. Its one failure was an unsupported matcher in the new test;
  replacing that matcher passed the focused rerun and the final targeted run.
- iOS Hermes export passes. Publication separately verifies the intended API
  URL and served launch-asset hash.
- No native dependency, backend, or API changes.

The evidence folder records source-derived static material studies at 375 and
390 widths. They are not native captures and do not establish keyboard,
gesture, larger-text, VoiceOver, performance or device rendering acceptance.
The temporary fixture, server and browser tab were removed after the bounded
review. No fixture configuration or dependency changes ship.

See [evidence provenance](evidence/2026-10-09-brand-continuity/README.md) and
[publication receipts](2026-10-09-mobile-v1-delivery.md).
