import { login } from "./actions";
import { SubmitButton } from "@/app/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <form action={login} className="w-full max-w-sm">
        <input type="hidden" name="next" value={next} />
        <h1 className="text-xl font-semibold tracking-tight">Inzpo</h1>
        <p className="mt-1 text-sm text-muted-foreground">The vault is private. Sign in to continue.</p>
        <input
          type="password"
          name="passphrase"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="Passphrase"
          aria-label="Passphrase"
          aria-invalid={params.error ? true : undefined}
          className="mt-6 min-h-[44px] w-full rounded-lg border border-input bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {params.error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">Incorrect passphrase — try again.</p>
        ) : null}
        <SubmitButton className="mt-4 min-h-[44px] w-full rounded-lg text-base font-medium" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
