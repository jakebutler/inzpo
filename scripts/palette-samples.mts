// Run: node --conditions=react-server --import tsx scripts/palette-samples.mts
import { readFile } from "node:fs/promises";
import { extractPalette, TARGET_CONTRAST } from "../lib/palette-extract";
import { COLOR_ROLES } from "../lib/db/schema";
import { markDerivedRoles } from "../lib/derived-roles";
import { MIN_ROLE_DELTA_E, pairwiseRoleDeltaE } from "../lib/color-distance";

const report = [];
for (const photo of ["IMG_6208", "IMG_6505", "IMG_5859"]) {
  const input = await readFile(`public/sample/${photo}.jpg`);
  const regionPixels = new Map<string, number>();
  let thumbnail = { width: 0, height: 0 };
  // One warm-up, then five sequential extractions; file IO and process startup
  // are excluded. The optional region audit only records the warm-up output.
  const palette = await extractPalette(input, (swatch, pixels, width, height) => {
    regionPixels.set(swatch.role!, pixels.length);
    thumbnail = { width, height };
  });
  const samplesMs = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await extractPalette(input);
    samplesMs.push(performance.now() - start);
  }
  const marked = markDerivedRoles(palette.swatches);
  const roles = COLOR_ROLES.map((role) => {
    const swatch = marked.find((s) => s.role === role);
    return {
      role,
      hex: palette.roles[role],
      empty: !swatch,
      regionSize: swatch?.patch ?? null,
      regionPixels: regionPixels.get(role) ?? null,
      share: swatch?.share ?? null,
      pin: swatch ? [swatch.pinX, swatch.pinY] : null,
      origin: swatch?.origin ?? null,
      legacyDerived: swatch?.derivedFrom != null,
    };
  });
  const pairwiseDeltaE = pairwiseRoleDeltaE(palette.roles);
  report.push({ photo, source: `public/sample/${photo}.jpg`, thumbnail, roles,
    backgroundTextContrast: palette.contrast, pairwiseDeltaE,
    minPairwiseDeltaE: pairwiseDeltaE.length ? Math.min(...pairwiseDeltaE.map((p) => p.deltaE)) : null,
    timing: { warmups: 1, runs: 5, samplesMs, medianMs: samplesMs.slice().sort((a, b) => a - b)[2] } });
}
console.log(JSON.stringify({
  command: "node --conditions=react-server --import tsx scripts/palette-samples.mts",
  deltaEMetric: "CIE76 (Euclidean CIELAB, sRGB / D65) on rounded role hexes; deltaE2000 per pair is informational",
  minimumRoleDeltaE: MIN_ROLE_DELTA_E,
  minimumBackgroundTextContrast: TARGET_CONTRAST,
  notes: [
    "Every filled hex is the measured RGB mean of one connected photo region. No tinting, padding or DB migration.",
    "Region size is the fraction of the full thumbnail. Share is colour-cluster coverage, not component size.",
    "Pins are normalized region centroids with origin region; a concave region's centroid can lie in a hole.",
    "Background prefers the largest connected light (L* >= 60) or neutral (C* < 12) real region passing 4.5:1 against the darkest suitable real text region, subject to CIE76 >= 12 from filled roles. A near-duplicate real component of the same subject class may replace primary to release larger trim; otherwise conflicting backgrounds are skipped. If none qualifies, the existing ranking is used.",
    "Shadow test: C* < 25, at least 10 L* below a side-adjacent real region of size >= 0.1%, and absolute chroma difference <= 5 C*. Lab hue gap is <= 30 degrees (including wrap) with both C* >= 3, or both regions have C* < 3. The largest light/neutral region (chosen before the contrast gate) is never classified as a shadow if it passes 4.5:1 against suitable text. Shadows are excluded from qualifying backgrounds and may fill any slot only as a last resort after its distinct non-shadow choices are exhausted.",
    "6505's largest qualifying cream trim is #d0c7b2. The initial facade #d5d2aa is only CIE76 10.47 away, so primary uses the real facade component #d6d2a6 (CIE76 12.35 from the cream). Both remain measured connected-region means, without whitening or recolouring.",
    "Empty roles remain null and display the existing dashed add-a-colour slot.",
  ],
  photos: report,
}, null, 2));
