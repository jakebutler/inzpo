import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("r3 string audit", () => {
  it("never surfaces inference env names in the brief stub or result UI", () => {
    expect(src("lib/brief.ts")).not.toMatch(/stub — no DO_INFERENCE/);
    expect(src("lib/brief.ts")).not.toContain("[stub");
    expect(src("app/components/KitResult.tsx")).not.toContain("DO_INFERENCE_API_KEY");
    expect(src("lib/brief.ts")).toMatch(/text:\s*null/);
  });

  it("sends oversize and unreadable photos to bad-image, outside the swallowed try", () => {
    const capture = src("app/capture/actions.ts");
    expect(capture).toMatch(/if \(length > MAX_UPLOAD_BYTES\) redirect\("\/capture\?error=bad-image"\)/);
    expect(capture).toMatch(/if \(file\.size > MAX_UPLOAD_BYTES\) redirect\("\/capture\?error=bad-image"\)/);
    expect(capture).not.toMatch(/if \(length > MAX_UPLOAD_BYTES\) redirect\([^)]+\);\s*const buffer/);
    const decodeCatch = capture.split("createImageItem")[1] ?? "";
    expect(decodeCatch).toContain('redirect("/capture?error=bad-image")');
  });

  it("gates Clerk setup copy and uses the retry auth line", () => {
    const login = src("app/login/page.tsx");
    expect(login).toContain("SignInUnavailable");
    expect(login).toContain("INZPO_DEV_AUTH");
    expect(src("app/login/SignInForm.tsx")).toContain("Sign-in isn't available right now.");
    expect(src("app/login/SignInForm.tsx")).toContain("Enter the email your invite went to.");
    expect(src("app/login/SignInForm.tsx")).toContain('id="clerk-captcha"');
    expect(src("app/login/SignInForm.tsx")).toContain("LoginIdleMark");
    expect(src("app/login/SignInForm.tsx")).toContain("decorateUrl");
    expect(src("app/login/SignInForm.tsx")).toContain("activateSession");
    expect(src("app/login/SignInForm.tsx")).toContain("clerkReady");
    expect(src("app/login/SignInForm.tsx")).not.toMatch(/finalize\(\s*\)/);
    expect(src("app/layout.tsx")).toContain('signInFallbackRedirectUrl="/capture"');
    expect(src("app/layout.tsx")).toContain('signUpFallbackRedirectUrl="/capture"');
    expect(src("app/login/page.tsx")).toContain("optionalOwnerId");
    expect(src("app/login/page.tsx")).toContain("if (userId) redirect(next)");
    expect(src("app/login/SignInForm.tsx")).toContain("isSignedIn");
    expect(src("app/login/SignInForm.tsx")).toContain("window.location.assign(dest)");
    expect(src("lib/auth/clerk-errors.ts")).toContain("Couldn't sign you in just now. Try again in a minute.");
    expect(src("lib/auth/clerk-errors.ts")).toContain("We couldn't verify you're human. Reload the page and try again.");
    expect(src("app/not-found.tsx")).toContain("NotFoundMark");
    expect(src("app/components/NotFoundMark.tsx")).toContain('pose="404"');
  });
});
