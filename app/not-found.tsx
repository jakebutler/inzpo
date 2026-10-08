import Link from "next/link";
import { NotFoundMark } from "@/app/components/NotFoundMark";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Inzpo</p>
      <h1 className="mt-2 font-heading text-[28px] font-semibold tracking-tight">This page isn't here.</h1>
      <p className="mt-2 text-base text-muted-foreground">Baku looked. Nothing to chew on.</p>
      <NotFoundMark />
      <div className="mt-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        <Link
          href="/"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground"
        >
          Back to Wall
        </Link>
      </div>
    </main>
  );
}
