import { BandStripe } from "@/app/components/BandStripe";
import { COLOR_ROLES } from "@/lib/db/schema";
import { emptyRoles, type RoleColors } from "@/lib/tokens";
import { kitDisplayName } from "@/lib/kit-name";

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
}: {
  title: string;
  imageSrc?: string | null;
  hexes?: Array<string | null>;
  roles?: RoleColors;
}) {
  const kit = roles ?? rolesFromList(hexes);
  const title = kitDisplayName({ title: rawTitle });
  return (
    <article className="inzpo-kit-card">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={title} className="inzpo-kit-card-photo" />
      ) : null}
      <BandStripe roles={kit} title={title} />
    </article>
  );
}
