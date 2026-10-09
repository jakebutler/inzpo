import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { resolveIcons } from "next/dist/lib/metadata/resolvers/resolve-icons";
import { IconsMetadata } from "next/dist/lib/metadata/generate/icons";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

vi.mock("next/font/google", () => ({
  Akaya_Kanadaka: () => ({ variable: "headline" }),
  Geist: () => ({ variable: "geist" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));
vi.mock("@clerk/nextjs", () => ({ ClerkProvider: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/lib/auth/clerk-configured", () => ({ isClerkConfigured: () => false }));
vi.mock("@/lib/auth/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => vi.fn(),
  createRouteMatcher: () => vi.fn(),
}));

import { metadata, viewport } from "@/app/layout";
import { GET } from "@/app/manifest.webmanifest/route";
import { config } from "@/middleware";

const icons = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];
const files = [
  ["favicon-32.png", 32], ["apple-touch-icon.png", 180],
  ["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512],
] as const;

describe("Designer web app icons", () => {
  it("renders exactly one sized PNG favicon and Apple icon through Next metadata", () => {
    const links = IconsMetadata({ icons: resolveIcons(metadata.icons) }) ?? [];
    const html = renderToStaticMarkup(createElement(Fragment, null, ...links.flat()));
    const { document } = parseHTML(`<html><head>${html}</head><body></body></html>`);
    const favicons = document.querySelectorAll('head link[rel~="icon"]');
    expect(favicons).toHaveLength(1);
    expect(favicons[0]?.getAttribute("href")).toBe("/icons/favicon-32.png");
    expect(favicons[0]?.getAttribute("sizes")).toBe("32x32");
    expect(favicons[0]?.getAttribute("type")).toBe("image/png");
    const apples = document.querySelectorAll('head link[rel="apple-touch-icon"]');
    expect(apples).toHaveLength(1);
    expect(apples[0]?.getAttribute("href")).toBe("/icons/apple-touch-icon.png");
    expect(apples[0]?.getAttribute("sizes")).toBe("180x180");
    expect(metadata.manifest).toBe("/manifest.webmanifest");
    expect(html).not.toContain("icon.svg");
    // File conventions would add extra head links alongside explicit metadata.
    for (const dir of ["app", "public"]) {
      expect(readdirSync(dir).filter(name => /^(?:favicon|icon|apple-icon)(?:\d+)?\.(?:ico|svg|png|jpg|jpeg|tsx?|jsx?)$/.test(name))).toEqual([]);
    }
    expect(existsSync("public/icon.svg")).toBe(false);
  });

  it("serves the three manifest icons with their separate purposes and paper colours", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/manifest+json");
    const manifest = await response.json();
    expect(manifest.icons).toEqual(icons);
    expect(manifest).toMatchObject({ name: "Inzpo", short_name: "Inzpo", start_url: "/capture", display: "standalone",
      theme_color: "#F3EEE4", background_color: "#F3EEE4" });
    expect(viewport.themeColor).toBe(manifest.theme_color);
  });

  it.each(files)("ships a valid %s at %ipx", async (file, size) => {
    const asset = readFileSync(`public/icons/${file}`);
    const image = await sharp(asset).metadata();
    expect([image.format, image.width, image.height]).toEqual(["png", size, size]);
  });

  it("skips Clerk middleware for all head/manifest URLs, including cache queries", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });
    for (const url of ["/manifest.webmanifest", ...files.map(([file]) => `/icons/${file}`)]) {
      expect(matches(url), url).toBe(false);
      expect(matches(`${url}?v=designer`), url).toBe(false);
    }
    expect(matches("/capture")).toBe(true);
    expect(matches("/media/example.png")).toBe(true);
  });
});
