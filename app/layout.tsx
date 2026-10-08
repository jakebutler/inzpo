import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { isClerkConfigured } from "@/lib/auth/clerk-configured";
import { INK, PAPER, VERMILION } from "@/lib/brand";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  adjustFontFallback: true,
});

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Inzpo",
  description: "Steal the colors off anything",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: PAPER,
  viewportFit: "cover",
};

async function LegacyClaim() {
  const { claimLegacyIfNeeded } = await import("@/lib/auth/owner");
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
    <html lang="en" className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider
            signInUrl="/login"
            signUpUrl="/login"
            afterSignOutUrl="/login"
            appearance={{
              variables: {
                colorBackground: PAPER,
                colorPrimary: VERMILION,
                colorForeground: INK,
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
