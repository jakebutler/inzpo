# Forest canvas material study

The phone report found Baku too close to the cream background. Compared the
approved neutral knitted Baku on current cream, forest mist, blue clay and lilac
chalk. Selected forest mist `#D8E3D9`: a cool, quiet ground that separates the
warm knit and cream objects while supporting the existing matte blue actions.

- `comparison.jpg`: four materials at 1440 × 870.
- `forest-375.jpg`: selected material at a 375-point browser viewport.

These are browser translations, not React Native/device captures. The small
paper card and its three swatches are illustrative material specimens, not a
real extracted kit or shipped home-screen layout. Baku is the existing approved
`apps/mobile/assets/baku-performance/neutral-monotone.webp`; button geometry,
colors and shadows were read from the shipping `buttonSurface` function. Fonts
and grain come from installed/committed app assets. No artwork was regenerated,
recolored or replaced. The temporary HTML fixture stays outside the repository, and its server was
stopped after the bounded review; only these review captures are committed.

The mobile CANVAS token applies to screens, navigation, Keep, the result fade,
caption backing, and color-detail scrim. Paper sheets, fields and actual stock
retain their warm colors; actual photo/swatches and stitched panels are intact.
The app configuration background matches for future native builds; the JS
screen/navigation changes are included in this Expo Go update.

Verification: lint, typecheck, 108 targeted tests in eight suites, and the iOS
Hermes export pass. Contrast coverage includes ink/helper text on the new
canvas and the primary control against it. Native appearance remains for the
next phone pass; these captures make no claim about iPhone performance.
