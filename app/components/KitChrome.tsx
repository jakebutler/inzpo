"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { kitWearStyle } from "@/lib/kit-wear";
import type { RoleColors } from "@/lib/tokens";

const KitChromeContext = createContext<{ roles: RoleColors; setRoles: (roles: RoleColors) => void } | null>(null);

export function useKitChrome() {
  return useContext(KitChromeContext);
}

export function KitChrome({ roles, children }: { roles: RoleColors; children: ReactNode }) {
  const [liveRoles, setRoles] = useState(roles);
  useEffect(() => setRoles(roles), [roles]);
  return (
    <KitChromeContext.Provider value={{ roles: liveRoles, setRoles }}>
      <div data-kit-wear style={kitWearStyle(liveRoles)}>
        {children}
      </div>
    </KitChromeContext.Provider>
  );
}
