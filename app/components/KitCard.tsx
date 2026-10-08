import { BandStripe } from "@/app/components/BandStripe";
import { COLOR_ROLES } from "@/lib/db/schema";
import { emptyRoles, type RoleColors } from "@/lib/tokens";
import { HANDOFF_KITS } from "@/lib/mascot";

function rolesFromList(hexes?: Array<string | null>): RoleColors {
  if (hexes && hexes.length > 0) {
    const roles = emptyRoles();
    COLOR_ROLES.forEach((role, i) => {
      const hex = hexes[i];
      if (hex) roles[role] = hex;
    });
    if (COLOR_ROLES.some((role) => roles[role])) return roles;
  }
  return { ...HANDOFF_KITS.IMG_6505 };
}

export function KitCard({
  title,
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
  return (
    <article>
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt={title} className="h-48 w-full object-cover" />
      ) : null}
      <BandStripe roles={kit} title={title} />
    </article>
  );
}
