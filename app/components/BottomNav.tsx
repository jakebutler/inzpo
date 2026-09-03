"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Plus, Tags } from "lucide-react";

const HIDDEN_ON = ["/capture", "/login"];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const item = (href: string, label: string, Icon: typeof Images) => {
    const active = pathname === href || (href === "/" && pathname.startsWith("/items"));
    return (
      <Link
        href={href}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around px-4">
        {item("/", "Wall", Images)}
        <Link
          href="/capture"
          aria-label="Capture"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/40 transition-transform active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </Link>
        {item("/vocab", "Tags", Tags)}
      </div>
    </nav>
  );
}
