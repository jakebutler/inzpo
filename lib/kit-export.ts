import { COLOR_ROLES } from "@/lib/db/schema";
import { designTokenColors, rolesFromColors, type RoleColors } from "@/lib/tokens";
import type { ItemDetail } from "@/lib/items";

export type BriefExportStatus = "pending" | "ready" | "failed" | "none";

export const KIT_EXPORT_FILES = ["tokens.json", "tokens.css", "brief.md", "texture.svg"] as const;

export function tokensJsonFromRoles(roles: RoleColors): string {
  const colors = designTokenColors(roles);
  return JSON.stringify(
    {
      $schema: "https://design-tokens.org/format",
      color: colors ?? {},
    },
    null,
    2,
  );
}

export function tokensJson(item: ItemDetail): string {
  return tokensJsonFromRoles(rolesFromColors(item.colors));
}

export function tokensCss(item: ItemDetail): string {
  const roles = rolesFromColors(item.colors);
  const colors = designTokenColors(roles);
  const lines = COLOR_ROLES.map((role) => {
    const token = colors?.[role];
    if (!token) return `  --color-${role}: transparent;`;
    const fallback = token.fallback ? " /* fallback */" : "";
    return `  --color-${role}: ${token.$value};${fallback}`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function briefMarkdown(text: string | null, status?: BriefExportStatus): string {
  const notes = text?.trim() ?? "";
  if (notes.length > 0) return `${notes}\n`;
  if (status === "failed") return "# Brief\n\nThe brief didn't finish. Re-run it from the kit in Inzpo.\n";
  if (status === "pending") return "# Brief\n\nThe brief is still running.\n";
  return "# Brief\n";
}

/** Wrap the tile PNG. Empty when the crop was flat and no tile exists. */
export function textureSvg(png: Buffer | Uint8Array | null): string {
  if (!png || png.byteLength === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"></svg>\n`;
  }
  const href = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="${href}" width="512" height="512"/></svg>\n`;
}
