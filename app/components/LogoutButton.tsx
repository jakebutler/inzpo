"use client";

import { useClerk } from "@clerk/nextjs";

export function LogoutButton() {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      onClick={() => {
        void signOut({ redirectUrl: "/login" });
      }}
      className="min-h-[44px] px-2 text-sm text-muted-foreground transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] hover:text-foreground"
    >
      Sign out
    </button>
  );
}
