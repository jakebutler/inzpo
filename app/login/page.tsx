import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <form action={login} className="w-full max-w-sm">
        <input type="hidden" name="next" value={next} />
        <h1 className="text-xl font-semibold tracking-tight">Inzpo</h1>
        <p className="mt-1 text-sm text-neutral-400">The vault is private. Sign in to continue.</p>
        <input
          type="password"
          name="passphrase"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="Passphrase"
          className="mt-6 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base outline-none focus:border-neutral-500"
        />
        {params.error ? (
          <p className="mt-2 text-sm text-red-400">Incorrect passphrase.</p>
        ) : null}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 hover:bg-white min-h-[44px]"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
