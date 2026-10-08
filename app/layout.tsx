import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { isClerkConfigured } from "@/lib/auth/clerk-configured";
import { claimLegacyIfNeeded } from "@/lib/auth/owner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inzpo",
  description: "Steal the colors off anything",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
};

async function LegacyClaim() {
  await claimLegacyIfNeeded();
  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <>
      {isClerkConfigured() ? <LegacyClaim /> : null}
      {children}
      <Toaster position="bottom-center" duration={4000} />
    </>
  );

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider
            signInUrl="/login"
            signUpUrl="/login"
            afterSignOutUrl="/login"
            appearance={{
              variables: {
                colorBackground: "#171717",
                colorPrimary: "#f5f5f5",
              },
            }}
          >
            {body}
          </ClerkProvider>
        ) : (
          body
        )}
      </body>
    </html>
  );
}
