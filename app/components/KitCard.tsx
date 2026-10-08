"use client";

import { BandStripe } from "@/app/components/BandStripe";
import { COLOR_ROLES } from "@/lib/db/schema";
import { emptyRoles, type RoleColors } from "@/lib/tokens";
import { useKitDisplayName } from "./useKitDisplayName";

function rolesFromList(hexes?: Array<string | null>): RoleColors {
  if (hexes && hexes.length > 0) {
    const roles = emptyRoles();
    COLOR_ROLES.forEach((role, i) => {
      const hex = hexes[i];
      if (hex) roles[role] = hex;
    });
    if (COLOR_ROLES.some((role) => roles[role])) return roles;
  }
  return emptyRoles();
}

export function KitCard({
  title: rawTitle,
  imageSrc,
  hexes,
  roles,
  createdAt,
}: {
  title: string | null;
  imageSrc?: string | null;
  hexes?: Array<string | null>;
  roles?: RoleColors;
  createdAt?: Date | string;
}) {
  const kit = roles ?? rolesFromList(hexes);
  const title = useKitDisplayName({ title: rawTitle, primaryHex: COLOR_ROLES.map((role) => kit[role]).find(Boolean), createdAt });
  return (
    <article className="inzpo-kit-card">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={title} className="inzpo-kit-card-photo" />
      ) : null}
      <BandStripe roles={kit} title={title} createdAt={createdAt} />
    </article>
  );
}
