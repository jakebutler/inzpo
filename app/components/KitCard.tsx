"use client";

import { useState } from "react";
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const kit = roles ?? rolesFromList(hexes);
  const title = useKitDisplayName({ title: rawTitle, primaryHex: COLOR_ROLES.map((role) => kit[role]).find(Boolean), createdAt });
  return (
    <article className="inzpo-kit-card">
      {imageSrc ? (
        <div data-card-media className="inzpo-kit-card-photo relative"
          style={{ backgroundColor: kit.primary ?? COLOR_ROLES.map(role => kit[role]).find(Boolean) ?? "var(--muted)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={title} className="absolute inset-0 h-full w-full object-cover"
            style={{ visibility: failedSrc === imageSrc ? "hidden" : undefined }}
            onLoad={() => setFailedSrc(null)} onError={() => setFailedSrc(imageSrc)} />
        </div>
      ) : null}
      <BandStripe roles={kit} title={title} createdAt={createdAt} />
    </article>
  );
}
