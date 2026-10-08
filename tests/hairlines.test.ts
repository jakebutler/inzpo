import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { KitResult } from "@/app/components/KitResult";
import { PaletteBands } from "@/app/components/PaletteBands";
import { BAND_H_EDITOR, BAND_H_RESULT, BAND_STAGGER_S } from "@/lib/brand";
import { COLOR_ROLES } from "@/lib/db/schema";
import { preferredHairline } from "@/lib/hairlines";
import { MOTION } from "@/lib/motion";
import { rolesFromColors } from "@/lib/tokens";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Avoid server actions during SSR while retaining the real band/empty-slot markup.
vi.mock("@/app/components/TokenEditor", () => ({
  TokenEditor: (props: Pick<ComponentProps<typeof KitResult>, "colors">) =>
    createElement(PaletteBands, { roles: rolesFromColors(props.colors), size: "result" }),
}));

// Like IMG_6208, the accent role is empty between filled roles.
const colors: ComponentProps<typeof KitResult>["colors"] = [
  { role: "primary", hex: "#7caed5", pinX: 0.2, pinY: 0.3, position: 0, origin: "region" },
  { role: "background", hex: "#dddddd", pinX: 0.6, pinY: 0.5, position: 3, origin: "region" },
  { role: "text", hex: "#334559", pinX: 0.8, pinY: 0.7, position: 5, origin: "region" },
];

describe("pin hairline geometry", () => {
  it.each([200, 298, 337])("keeps every line inside a %spx photo, above all result/editor bands", (photoBottom) => {
    for (const bandHeight of [BAND_H_RESULT, BAND_H_EDITOR]) {
      // Cover crops can map a sample above or below the visible photo.
      for (const sampleY of [-12, 0, photoBottom / 2, photoBottom, photoBottom + 12]) {
        const lines = COLOR_ROLES.map((role, i) => {
          const row = colors.find((color) => color.role === role);
          const band = {
            left: 0, right: 390,
            top: photoBottom + i * bandHeight,
            bottom: photoBottom + (i + 1) * bandHeight,
            visible: true,
          };
          return preferredHairline(row ? row.pinX! * 390 : null, row ? sampleY : null, band, photoBottom);
        });
        expect(lines[COLOR_ROLES.indexOf("accent")]).toBeNull();
        expect(lines.filter(Boolean)).toHaveLength(colors.length);
        for (const line of lines) {
          if (!line) continue;
          expect(Math.min(line.y1, line.y2)).toBeGreaterThanOrEqual(0);
          expect(Math.max(line.y1, line.y2)).toBeLessThanOrEqual(photoBottom);
          expect(line.y2).toBe(photoBottom);
          expect(line.x2).toBe(line.x1);
        }
      }
    }
  });

  it("omits lines for hidden bands and missing pin coordinates", () => {
    const band = { left: 0, top: 337, right: 390, bottom: 377, visible: true };
    expect(preferredHairline(null, null, band, 337)).toBeNull();
    expect(preferredHairline(80, null, band, 337)).toBeNull();
    expect(preferredHairline(null, 20, band, 337)).toBeNull();
    expect(preferredHairline(80, 20, { ...band, visible: false }, 337)).toBeNull();
  });
});

describe("photo hairline clipping", () => {
  it("nests both animated line strokes in the SVG inside the photo container", () => {
    // SSR has no measured leaders. Inspect the JSX ancestry of the actual line
    // elements as well, so moving them outside the clipped photo fails this test.
    const source = ts.createSourceFile("KitResult.tsx", readFileSync("app/components/KitResult.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lines: ts.JsxSelfClosingElement[] = [];
    function visit(node: ts.Node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "line") lines.push(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const ancestors: ts.JsxOpeningElement[] = [];
      for (let parent = line.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent)) ancestors.push(parent.openingElement);
      }
      const svg = ancestors.find((node) => node.tagName.getText(source) === "svg");
      expect(svg).toBeDefined();
      expect(svg!.getText(source)).toContain('overflow: "hidden"');
      expect(svg!.getText(source)).toContain("h-full w-full");
      expect(ancestors.some((node) => node.attributes.properties.some(
        (attr) => ts.isJsxAttribute(attr) && attr.name.getText(source) === "data-photo-fold",
      ))).toBe(true);
    }
  });

  describe.each([false, true])("saved=%s", (saved) => {
    it.each(["hold", "play", "mid", "landed"] as const)("clips the photo SVG during %s and while editing", (reveal) => {
      for (const openRole of [null, "background"] as const) {
        const html = renderToStaticMarkup(createElement(KitResult, {
          itemId: "hairline-kit", title: "IMG_6208", imageSrc: "/sample/IMG_6208.jpg",
          width: 390, height: 488, tileSrc: null, colors, saved,
          preview: { reveal, openRole },
        }));
        const { document } = parseHTML(html);
        const photo = document.querySelector("[data-photo-fold]")!;
        const svg = photo.querySelector("svg")!;
        expect(svg).not.toBeNull();
        expect(svg.parentElement).toBe(photo);
        expect(svg.getAttribute("style")).toContain("overflow:hidden");
        expect(svg.classList.contains("h-full")).toBe(true);
        expect(svg.classList.contains("w-full")).toBe(true);
        expect(document.querySelector('[data-pin="accent"]')).toBeNull();
        expect(document.querySelectorAll("[data-pin]")).toHaveLength(colors.length);
        const empty = document.querySelector('[data-role="accent"]')!;
        expect(empty.textContent).toBe("No accent in this one. Add a color.");
        expect(photo.contains(empty)).toBe(false);
      }
    });
  });

  it("keeps the existing six-band reveal stagger and duration", () => {
    expect(BAND_STAGGER_S).toBe(0.06);
    expect(MOTION.enter.duration + (COLOR_ROLES.length - 1) * BAND_STAGGER_S).toBeLessThan(1);
  });
});
