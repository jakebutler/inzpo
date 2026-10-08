import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { kitDisplayName } from "@/lib/kit-name";
import { ExportKitButton } from "@/app/components/ExportKitButton";

export function SavedKitHeader({
  title,
  backHref,
  itemId,
}: {
  title: string;
  backHref: string;
  itemId?: string;
}) {
  const name = kitDisplayName({ title });
  return (
    <header
      data-saved-header
      className="sticky top-0 z-10 flex items-center gap-1 bg-background px-2 py-2"
    >
      <Link
        href={backHref}
        aria-label="Back"
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
      </Link>
      <h1 className="font-heading min-w-0 flex-1 truncate text-[22px] leading-7">{name || <span data-title-skeleton aria-hidden="true" className="block h-3 w-32 rounded bg-current opacity-10" />}</h1>
      {itemId ? <ExportKitButton itemId={itemId} /> : null}
    </header>
  );
}
