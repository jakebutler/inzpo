import { NextResponse } from "next/server";
import { PAPER } from "@/lib/brand";

export const dynamic = "force-dynamic";

export function GET() {
  const manifest = {
    name: "Inzpo",
    short_name: "Inzpo",
    description: "Steal the colors off anything",
    start_url: "/capture",
    display: "standalone",
    background_color: PAPER,
    theme_color: PAPER,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
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
