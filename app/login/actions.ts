"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/auth/session";
import { passphraseMatches } from "@/lib/auth/passphrase";
import { clientKey, clearFailures, isRateLimited, recordFailure } from "@/lib/auth/ratelimit";
import { validateRelativePath } from "@/lib/auth/redirect";

export async function login(formData: FormData): Promise<void> {
  const next = validateRelativePath(formData.get("next") as string | null);
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const key = clientKey(ip);

  if (isRateLimited(key)) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  }

  const passphrase = (formData.get("passphrase") as string) ?? "";
  if (!passphraseMatches(passphrase)) {
    recordFailure(key);
    redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  }

  clearFailures(key);
  const token = await createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  redirect(next);
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
