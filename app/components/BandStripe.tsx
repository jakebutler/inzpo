import { COLOR_ROLES } from "@/lib/db/schema";
import { EMPTY_ROLE_COPY } from "@/lib/brief-copy";
import { bandLabelColor, matchesPageBackground } from "@/lib/contrast";
import { PAGE_BAND_HAIRLINE, PAPER } from "@/lib/brand";
import { designTokenColors, emptyRoles, type RoleColors } from "@/lib/tokens";

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
}: {
  roles: RoleColors;
  title?: string | null;
  italicEmptyTitle?: boolean;
}) {
  const tokens = designTokenColors(roles);
  return (
    <figure className="inzpo-kit-stripe">
      <div className="inzpo-bands inzpo-bands-stripe" aria-hidden={title ? undefined : true}>
        {COLOR_ROLES.map((role) => {
          const filled = roles[role];
          const hex = filled ?? tokens?.[role]?.$value;
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
      {title ? (
        <figcaption className={`inzpo-kit-stripe-name font-heading${italicEmptyTitle ? " italic" : ""}`}>
          {title}
        </figcaption>
      ) : null}
    </figure>
  );
}
