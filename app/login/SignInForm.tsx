"use client";

import { useEffect, useRef, useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { gsap } from "gsap";
import { MOTION, motionFor } from "@/lib/motion";
import { validateRelativePath } from "@/lib/auth/redirect";
import {
  INVITE_ONLY_MESSAGE,
  OFFLINE_MESSAGE,
  classifyAuthError,
  messageForAuthError,
} from "@/lib/auth/clerk-errors";

type Step = "email" | "code";
type Mode = "signin" | "signup";
type UiState = "empty" | "ready" | "loading" | "error" | "offline" | "done";

export function SignInForm({ next, ticket }: { next: string; ticket: string | null }) {
  const { signIn, fetchStatus: signInFetch } = useSignIn();
  const { signUp, fetchStatus: signUpFetch } = useSignUp();
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dest = validateRelativePath(next) === "/" ? "/capture" : validateRelativePath(next);

  useEffect(() => {
    function sync() {
      setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!ticket || !signUp) return;
    let cancelled = false;
    void (async () => {
      const result = await signUp.create({ strategy: "ticket", ticket });
      if (cancelled) return;
      if (result.error) {
        setError(messageForAuthError(classifyAuthError(result.error)));
        return;
      }
      if (signUp.status === "complete") {
        const fin = await signUp.finalize();
        if (fin.error) {
          setError(messageForAuthError(classifyAuthError(fin.error)));
          return;
        }
        setDone(true);
        window.location.assign(dest);
      } else {
        await signUp.verifications.sendEmailCode();
        setMode("signup");
        setStep("code");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket, signUp, dest]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const { duration, ease } = motionFor("enter");
    gsap.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration, ease, overwrite: "auto" });
  }, [step]);

  const fetching = signInFetch === "fetching" || signUpFetch === "fetching";
  const uiState: UiState = done
    ? "done"
    : offline
      ? "offline"
      : fetching
        ? "loading"
        : error
          ? "error"
          : email.length === 0 && step === "email"
            ? "empty"
            : "ready";

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (offline) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    if (!signIn || !signUp) return;
    const identifier = email.trim();
    if (!identifier) return;

    const signInResult = await signIn.emailCode.sendCode({ emailAddress: identifier });
    if (!signInResult.error) {
      setMode("signin");
      setStep("code");
      return;
    }

    const signUpResult = await signUp.create({ emailAddress: identifier });
    if (signUpResult.error) {
      setError(messageForAuthError(classifyAuthError(signUpResult.error)));
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setError(messageForAuthError(classifyAuthError(sent.error)));
      return;
    }
    setMode("signup");
    setStep("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (offline) {
      setError(OFFLINE_MESSAGE);
      return;
    }
    if (!signIn || !signUp) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    if (mode === "signin") {
      const verified = await signIn.emailCode.verifyCode({ code: trimmed });
      if (verified.error) {
        setError(messageForAuthError(classifyAuthError(verified.error)));
        return;
      }
      const fin = await signIn.finalize();
      if (fin.error) {
        setError(messageForAuthError(classifyAuthError(fin.error)));
        return;
      }
    } else {
      const verified = await signUp.verifications.verifyEmailCode({ code: trimmed });
      if (verified.error) {
        setError(messageForAuthError(classifyAuthError(verified.error)));
        return;
      }
      const fin = await signUp.finalize();
      if (fin.error) {
        setError(messageForAuthError(classifyAuthError(fin.error)));
        return;
      }
    }
    setDone(true);
    window.location.assign(dest);
  }

  const primaryLabel = step === "email" ? "Send code" : "Sign in";
  const pendingLabel = step === "email" ? "Sending…" : "Signing in…";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Inzpo</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Steal the colors off anything</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {step === "email" ? "Enter the email Jake invited." : `Enter the code sent to your email.`}
        </p>
      </header>

      <div ref={panelRef} className="flex flex-1 flex-col px-6 pt-8">
        {uiState === "offline" ? (
          <p role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-base">
            {OFFLINE_MESSAGE}
          </p>
        ) : null}
        {uiState === "done" ? (
          <p role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-base">
            Signed in. Opening Snap…
          </p>
        ) : null}

        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-1 flex-col">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              aria-invalid={error ? true : undefined}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="mt-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
              <button
                type="submit"
                disabled={fetching || offline || email.trim().length === 0}
                className="min-h-[44px] w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:opacity-50"
              >
                {fetching ? pendingLabel : primaryLabel}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-1 flex-col">
            <label htmlFor="code" className="text-sm font-medium">
              One-time code
            </label>
            <input
              id="code"
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              aria-invalid={error ? true : undefined}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-input bg-card px-4 py-3 text-base tabular-nums tracking-[0.3em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Check Mail. iPhone can autofill the code.</p>
            )}
            <button
              type="button"
              onClick={() => {
                const { duration, ease } = motionFor("leave");
                const el = panelRef.current;
                if (el) gsap.to(el, { autoAlpha: 0, duration, ease, overwrite: "auto" });
                setStep("email");
                setCode("");
                setError(null);
                void MOTION;
              }}
              className="mt-4 min-h-[44px] self-start text-base text-muted-foreground underline-offset-4 hover:underline"
            >
              Use a different email
            </button>
            <div className="mt-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
              <button
                type="submit"
                disabled={fetching || offline || code.trim().length === 0}
                className="min-h-[44px] w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:opacity-50"
              >
                {fetching ? pendingLabel : primaryLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ClerkMissing({ next }: { next: string }) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Inzpo</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Clerk isn't configured yet</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Preview sign-in needs Jake's Clerk development instance. Set the keys on the Vercel Preview environment, then
        invite friends from the Clerk dashboard.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-base">
        <li>Create a Clerk application in development.</li>
        <li>Turn on Invite-only (restricted) sign-up.</li>
        <li>Enable email verification code. Turn off passwords and magic links.</li>
        <li>
          Add <code className="font-mono text-sm">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
          <code className="font-mono text-sm">CLERK_SECRET_KEY</code> to Vercel Preview.
        </li>
        <li>
          Set <code className="font-mono text-sm">NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login</code> and after-sign-in to{" "}
          <code className="font-mono text-sm">/capture</code>.
        </li>
      </ol>
      <p className="mt-6 text-sm text-muted-foreground">Intended destination: {validateRelativePath(next)}</p>
      <p className="mt-2 text-sm text-muted-foreground">{INVITE_ONLY_MESSAGE}</p>
    </main>
  );
}
