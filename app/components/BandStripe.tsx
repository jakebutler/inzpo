"use client";

import { COLOR_ROLES } from "@/lib/db/schema";
import { EMPTY_ROLE_COPY } from "@/lib/brief-copy";
import { bandLabelColor, matchesPageBackground } from "@/lib/contrast";
import { PAGE_BAND_HAIRLINE, PAPER } from "@/lib/brand";
import { emptyRoles, type RoleColors } from "@/lib/tokens";
import { useKitDisplayName } from "./useKitDisplayName";

export function rolesFromHexes(hexes: Array<string | null | undefined>): RoleColors {
  const roles = emptyRoles();
  COLOR_ROLES.forEach((role, i) => {
    const hex = hexes[i];
    if (hex) roles[role] = hex;
  });
  return roles;
}

export function BandStripe({
  roles,
  title,
  italicEmptyTitle = false,
  createdAt,
}: {
  roles: RoleColors;
  title?: string | null;
  italicEmptyTitle?: boolean;
  createdAt?: Date | string;
}) {
  const name = useKitDisplayName({ title, primaryHex: COLOR_ROLES.map((role) => roles[role]).find(Boolean), createdAt });
  return (
    <figure className="inzpo-kit-stripe">
      <div className="inzpo-bands inzpo-bands-stripe" aria-hidden={title != null && name ? undefined : true}>
        {COLOR_ROLES.map((role) => {
          const hex = roles[role];
          if (!hex) {
            const emptyInk = bandLabelColor(PAPER, roles);
            return (
              <span
                key={role}
                className="inzpo-band inzpo-band-empty inzpo-band-stripe"
                title={EMPTY_ROLE_COPY(role)}
                style={{ color: emptyInk }}
              >
                <span className="sr-only">{EMPTY_ROLE_COPY(role)}</span>
              </span>
            );
          }
          const ink = bandLabelColor(hex, roles);
          const hair = matchesPageBackground(hex, PAPER);
          return (
            <span
              key={role}
              className="inzpo-band inzpo-band-stripe"
              style={{
                backgroundColor: hex,
                color: ink,
                boxShadow: hair ? `inset 0 0 0 1px ${PAGE_BAND_HAIRLINE}` : undefined,
              }}
            />
          );
        })}
      </div>
      {title != null && name ? (
        <figcaption className={`inzpo-kit-stripe-name font-heading whitespace-normal break-words text-balance${italicEmptyTitle ? " italic" : ""}`}>
          {name}
        </figcaption>
      ) : title != null ? (
        <figcaption className="inzpo-kit-stripe-name font-heading whitespace-normal break-words text-balance">
          <span data-title-pending className="opacity-60">Naming it…</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
