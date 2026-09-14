"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * A <form> that runs its FormData server action imperatively inside a
 * transition: controls disabled and the form dimmed while pending, the
 * outcome toasted, inputs reset after success. Use where useFormStatus
 * cannot see the submission.
 */
export function ActionForm({
  action,
  success,
  failure,
  prepare,
  className,
  children,
  onDone,
}: {
  action: (fd: FormData) => Promise<void>;
  success: string;
  failure?: string;
  prepare?: (fd: FormData, e: FormEvent<HTMLFormElement>) => void;
  className?: string;
  children: ReactNode;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={cn(className, pending && "opacity-60")}
      aria-busy={pending || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        prepare?.(fd, e);
        const form = e.currentTarget;
        startTransition(async () => {
          try {
            await action(fd);
            toast.success(success);
            form.reset();
            onDone?.();
          } catch {
            toast.error(failure ?? "That didn't go through — try again.");
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
