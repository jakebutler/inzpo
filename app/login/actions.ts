"use server";

import { redirect } from "next/navigation";

/** Logout is handled client-side by Clerk's signOut. Kept as a fallback redirect. */
export async function logout(): Promise<void> {
  redirect("/login");
}
