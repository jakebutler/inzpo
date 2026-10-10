// Run: node --import tsx scripts/palette-delta-e.mts [report-or-live-hexes.json]
// Default: docs/palette-extraction-r81.json. Live input can be an array like:
// [{ "photo": "IMG_6505", "roles": { "primary": "#d5d2aa", "text": "#020505", "accent": null } }]
// Also accepts a report's { photos: [...] } with roles as [{ role, hex }].
import { readFile } from "node:fs/promises";
import { isHexColor } from "../lib/colors";
import { MIN_ROLE_DELTA_E, pairwiseRoleDeltaE } from "../lib/color-distance";

const input = JSON.parse(await readFile(process.argv[2] ?? "docs/palette-extraction-r81.json", "utf8"));
const photos: Array<{ photo: string; roles: Record<string, string | null> | Array<{ role: string; hex: string | null }> }> =
  Array.isArray(input) ? input : input.photos ?? [input];
const report = photos.map(({ photo, roles }) => {
  const roleMap: Record<string, string | null> = Array.isArray(roles)
    ? Object.fromEntries(roles.map(({ role, hex }) => [role, hex])) : roles;
  for (const [role, hex] of Object.entries(roleMap)) {
    if (hex !== null && (typeof hex !== "string" || !isHexColor(hex))) throw new Error(`Invalid hex for ${role}`);
  }
  const pairs = pairwiseRoleDeltaE(roleMap);
  return { photo, filledRoleCount: Object.values(roleMap).filter((hex) => hex !== null).length,
    minPairwiseDeltaE: pairs.length ? Math.min(...pairs.map((p) => p.deltaE)) : null,
    passes: pairs.every((p) => p.deltaE >= MIN_ROLE_DELTA_E), pairs };
});
console.log(JSON.stringify({ deltaEMetric: "CIE76 (Euclidean CIELAB, sRGB / D65); deltaE2000 per pair is informational",
  minimumRoleDeltaE: MIN_ROLE_DELTA_E, photos: report }, null, 2));
