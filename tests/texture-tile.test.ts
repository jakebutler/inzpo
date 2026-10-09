import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { KitResult } from "@/app/components/KitResult";
import type { BriefSlotStatus } from "@/app/components/BriefSlot";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Keep this render focused on KitResult's brief and texture section.
vi.mock("@/app/components/TokenEditor", () => ({
  TokenEditor: ({ children }: { children: ReactNode }) => children,
}));

function renderKit(status?: BriefSlotStatus, saved = false, stub = false, tileSrc: string | null = "/media/tile.webp") {
  const html = renderToStaticMarkup(createElement(KitResult, {
    itemId: "kit",
    title: "Warm brick",
    imageSrc: null,
    width: 390,
    height: 488,
    colors: [],
    tileSrc,
    saved,
    preview: { status, stub, text: status === "ready" && !stub ? "Warm brick in shade." : null },
  }));
  return { html, document: parseHTML(html).document };
}

describe("texture tile waits for the brief", () => {
  describe.each([false, true])("saved=%s", (saved) => {
    it.each([undefined, "pending"] as const)("omits the entire texture section while status is %s", (status) => {
      const { html, document } = renderKit(status, saved);
      expect(document.querySelector('[aria-label="Brief"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Texture tile"]')).toBeNull();
      expect(html).not.toContain("/media/tile.webp");
      expect(html).not.toContain("Move crop");
    });

    it.each([
      { status: "ready", stub: false },
      { status: "failed", stub: false },
      { status: "ready", stub: true },
    ] as const)("renders the tile and crop control for $status (stub=$stub)", ({ status, stub }) => {
      const { html, document } = renderKit(status, saved, stub);
      const tile = document.querySelector('[aria-label="Texture tile"]');
      expect(tile).not.toBeNull();
      expect(tile?.getAttribute("style")).toContain("/media/tile.webp");
      expect(html).toContain("Move crop");
      // The new section follows the brief and contrast, leaving their layout intact.
      expect(html.indexOf('aria-label="Brief"')).toBeLessThan(html.indexOf('aria-label="Texture tile"'));
    });
  });

  it("omits the section when a completed kit has no tile", () => {
    const { html } = renderKit("ready", false, false, null);
    expect(html).not.toContain("Texture tile");
    expect(html).not.toContain("Move crop");
  });

  it("keeps the pending QA result free of a texture strip", () => {
    const qa = readFileSync("app/dev/qa/QaStates.tsx", "utf8");
    const pendingResult = qa.slice(qa.indexOf('state === "result-kit"'), qa.indexOf('state === "result-empty"'));
    expect(pendingResult).toContain('<BriefSlot status="pending"');
    expect(pendingResult).not.toContain("Texture tile");
    expect(pendingResult).not.toContain("Move crop");
  });
});
