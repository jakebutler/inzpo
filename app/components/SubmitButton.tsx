"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

/**
 * Submit button that reflects the enclosing form's pending state:
 * disabled + aria-busy while the server action runs, with optional
 * alternate label. Must be rendered inside a <form>.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </Button>
  );
}
