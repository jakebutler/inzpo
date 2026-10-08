import { redirect } from "next/navigation";
import { SignInForm, ClerkMissing, SignInUnavailable } from "./SignInForm";
import { isClerkConfigured } from "@/lib/auth/clerk-configured";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { validateRelativePath } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

function showClerkSetup(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.INZPO_DEV_AUTH === "1";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; __clerk_ticket?: string }>;
}) {
  const params = await searchParams;
  const next = validateRelativePath(typeof params.next === "string" ? params.next : "/capture");
  const ticket = typeof params.__clerk_ticket === "string" ? params.__clerk_ticket : null;

  if (!isClerkConfigured()) {
    if (showClerkSetup()) return <ClerkMissing next={next} />;
    return <SignInUnavailable />;
  }

  if (isDevAuthBypassEnabled()) redirect(next);

  return <SignInForm next={next} ticket={ticket} />;
}
