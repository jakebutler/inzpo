"use client";

import { useEffect, useRef, useState } from "react";
import { pageChromeColors, pendingTitleColor } from "@/lib/contrast";
import { INK, PAPER } from "@/lib/brand";
import { useKitChrome } from "./KitChrome";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useKitDisplayName } from "./useKitDisplayName";
import type { BriefState } from "@/lib/brief-state";
import { ExportKitButton } from "@/app/components/ExportKitButton";

export function SavedKitHeader({
  title,
  backHref,
  itemId,
  primaryHex,
  brief,
}: {
  title: string | null;
  backHref: string;
  itemId?: string;
  primaryHex?: string | null;
  brief?: BriefState | null;
}) {
  const chrome = useKitChrome();
  const { background, ink } = chrome ? pageChromeColors(chrome.roles) : { background: PAPER, ink: INK };
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => {
      let beneath = window.scrollY > 0;
      for (let node = headerRef.current?.parentElement; node; node = node.parentElement) {
        beneath ||= node.scrollTop > 0;
      }
      setScrolled(beneath);
    };
    update();
    window.addEventListener("scroll", update, true);
    return () => window.removeEventListener("scroll", update, true);
  }, []);
  const name = useKitDisplayName({ title, primaryHex, brief });
  return (
    <header
      ref={headerRef}
      data-saved-header
      data-header-scrolled={scrolled ? "true" : "false"}
      style={{ boxShadow: scrolled ? "0 1px 0 color-mix(in srgb, var(--foreground) 18%, transparent)" : undefined }}
      className="sticky top-0 z-10 flex items-center gap-1 bg-background text-foreground px-2 py-2"
    >
      <Link
        href={backHref}
        aria-label="Back"
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
      </Link>
      <h1 className="font-heading min-w-0 flex-1 whitespace-normal break-words text-balance text-[22px] leading-7">{name || <span data-title-pending style={{ color: pendingTitleColor(background, ink) }}>Naming it…</span>}</h1>
      {itemId ? <div className="shrink-0"><ExportKitButton itemId={itemId} /></div> : null}
    </header>
  );
}
