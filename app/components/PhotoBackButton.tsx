import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { INK, PAPER, PHOTO_BACK_PX, PHOTO_BACK_LEFT_PX, PHOTO_BACK_TOP_PX } from "@/lib/brand";

export function PhotoBackButton({
  href,
  placement = "photo",
}: {
  href: string;
  placement?: "photo" | "header";
}) {
  if (typeof href !== "string" || href.length === 0) return null;
  const photo = placement === "photo";
  return (
    <Link
      href={href}
      aria-label="Back"
      data-photo-back
      className={
        photo
          ? "absolute z-[21] flex items-center justify-center rounded-full"
          : "relative z-[21] flex shrink-0 items-center justify-center rounded-full"
      }
      style={{
        width: PHOTO_BACK_PX,
        height: PHOTO_BACK_PX,
        left: photo ? PHOTO_BACK_LEFT_PX : undefined,
        top: photo ? `calc(env(safe-area-inset-top, 0px) + ${PHOTO_BACK_TOP_PX}px)` : undefined,
        backgroundColor: `color-mix(in srgb, ${PAPER} 85%, transparent)`,
        color: INK,
        pointerEvents: "auto",
      }}
    >
      <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
    </Link>
  );
}
