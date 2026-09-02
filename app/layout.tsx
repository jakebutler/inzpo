import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inzpo",
  description: "A personal design-inspiration vault",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
