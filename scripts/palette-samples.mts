// Run: node --conditions=react-server --import tsx scripts/palette-samples.mts
import { readFile } from "node:fs/promises";
import { extractPalette } from "../lib/palette-extract";
import { COLOR_ROLES } from "../lib/db/schema";
import { markDerivedRoles } from "../lib/derived-roles";

const report = [];
for (const photo of ["IMG_6208", "IMG_6505", "IMG_5859"]) {
  const palette = await extractPalette(await readFile(`public/sample/${photo}.jpg`));
  const marked = markDerivedRoles(palette.swatches);
  const roles = COLOR_ROLES.map((role) => {
    const swatch = marked.find((s) => s.role === role);
    return {
      role,
      hex: palette.roles[role],
      share: swatch?.share ?? null,
      pin: swatch ? [swatch.pinX, swatch.pinY] : null,
      legacyDerived: swatch?.derivedFrom != null,
    };
  });
  report.push({ photo, roles });
}
console.log(JSON.stringify(report, null, 2));
