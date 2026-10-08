import type { ReactNode } from "react";
import { kitWearStyle } from "@/lib/kit-wear";
import type { RoleColors } from "@/lib/tokens";

export function KitChrome({ roles, children }: { roles: RoleColors; children: ReactNode }) {
  return (
    <div data-kit-wear style={kitWearStyle(roles)}>
      {children}
    </div>
  );
}
