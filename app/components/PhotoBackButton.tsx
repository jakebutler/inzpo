import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { INK, PAPER, PHOTO_BACK_PX } from "@/lib/brand";

export function PhotoBackButton({ href }: { href: string }) {
  if (typeof href !== "string" || href.length === 0) return null;
  return (
    <Link
      href={href}
      aria-label="Back"
      data-photo-back
      className="absolute left-3 top-3 z-[21] flex items-center justify-center rounded-full"
      style={{
        width: PHOTO_BACK_PX,
        height: PHOTO_BACK_PX,
        backgroundColor: `color-mix(in srgb, ${PAPER} 85%, transparent)`,
        color: INK,
      }}
    >
      <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
    </Link>
  );
}
