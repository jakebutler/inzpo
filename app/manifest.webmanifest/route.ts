import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#0a0a0a"/><text x="256" y="340" font-family="system-ui, sans-serif" font-size="280" font-weight="700" fill="#fafafa" text-anchor="middle">I</text></svg>`;

export function GET() {
  const manifest = {
    name: "Inzpo",
    short_name: "Inzpo",
    description: "A personal design-inspiration vault",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "image",
            accept: ["image/*"],
          },
        ],
      },
    },
  };
  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
