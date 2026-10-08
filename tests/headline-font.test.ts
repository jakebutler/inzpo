import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BriefSlot, type BriefSlotStatus } from "@/app/components/BriefSlot";
import { HANDOFF_KITS, MASCOT_COPY } from "@/lib/mascot";

const src = (p: string) => readFileSync(p, "utf8");

describe("headline font (Akaya Kanadaka)", () => {
  it("loads Akaya Kanadaka via next/font/google as the headline token, not Fraunces", () => {
    const layout = src("app/layout.tsx");
    expect(layout).toMatch(/import \{ Akaya_Kanadaka, Geist, Geist_Mono \} from "next\/font\/google"/);
    expect(layout).toContain('variable: "--font-headline"');
    expect(layout).not.toMatch(/Fraunces/);
    const css = src("app/globals.css");
    expect(css).toContain("--font-heading: var(--font-headline);");
    expect(css).not.toMatch(/--font-fraunces/);
    expect(css).toContain("--font-sans: var(--font-geist);");
  });

  it("uses the headline face only for kit names, screen titles and the brief", () => {
    expect(src("app/components/SavedKitHeader.tsx")).toMatch(/<h1 className="font-heading/);
    expect(src("app/components/BandStripe.tsx")).toContain("inzpo-kit-stripe-name font-heading");
    expect(src("app/components/BriefSlot.tsx")).toContain("font-heading");
    // The contrast sample is UI, so it stays in Geist; single-weight face gets no faux bold.
    expect(src("app/components/ContrastAa.tsx")).toContain('className="font-sans text-[40px]');
    expect(src("app/login/SignInForm.tsx")).not.toMatch(/font-heading[^"]*font-semibold/);
  });

  it.each([
    { name: "Sheet", Root: Sheet, Title: SheetTitle },
    { name: "Dialog", Root: Dialog, Title: DialogTitle },
    { name: "AlertDialog", Root: AlertDialog, Title: AlertDialogTitle },
  ])("$name headline titles use the single available weight", ({ Root, Title }) => {
    const { document } = parseHTML(renderToStaticMarkup(
      createElement(Root, null, createElement(Title, null, "Screen title")),
    ));
    const title = document.querySelector("h2")!;
    expect(title.classList.contains("font-heading")).toBe(true);
    expect(title.classList.contains("font-normal")).toBe(true);
    expect(title.className).not.toMatch(/font-(medium|semibold|bold)/);

    // Callers can still request a Geist title with its UI weight.
    const geist = parseHTML(renderToStaticMarkup(createElement(Root, null,
      createElement(Title, { className: "font-sans font-medium" }, "UI title"),
    ))).document.querySelector("h2")!;
    expect(geist.classList.contains("font-sans")).toBe(true);
    expect(geist.classList.contains("font-medium")).toBe(true);
    expect(geist.classList.contains("font-heading")).toBe(false);
  });

  it.each(["pending", "failed", "ready"] as BriefSlotStatus[])(
    "%s brief state keeps status and retry copy in Geist", (status) => {
      const note = "Warm stone with a small red accent.";
      const { document } = parseHTML(renderToStaticMarkup(createElement(BriefSlot, {
        status, note, kit: HANDOFF_KITS.IMG_6208,
      })));
      const headlines = [...document.querySelectorAll(".font-heading")];
      expect(headlines.map(node => node.textContent)).toEqual(status === "ready" ? [note] : []);
      if (status === "failed") {
        const retry = document.querySelector("[data-brief-text]")!;
        expect(retry.textContent).toBe(MASCOT_COPY["error-brief-retry"]);
        expect(retry.classList.contains("font-sans")).toBe(true);
        expect(retry.closest(".font-heading")).toBeNull();
      }
    },
  );

  it("keeps the saved caption in Geist while the saved brief uses the headline face", () => {
    const note = "Warm stone with a small red accent.";
    const { document } = parseHTML(renderToStaticMarkup(createElement(BriefSlot, {
      status: "ready", saved: true, note, kit: HANDOFF_KITS.IMG_6208,
    })));
    expect(document.querySelector(".font-heading")?.textContent).toBe(note);
    const caption = document.querySelector("[data-saved-caption]")!;
    expect(caption.textContent).toBe(MASCOT_COPY.success);
    expect(caption.closest(".font-heading")).toBeNull();
  });

  it.each(["r6", "r7", "fold"])("%s capture guard checks the loaded headline token", revision => {
    const script = src(`scripts/qa-shots-${revision}.mts`);
    expect(script).toContain('headlineFont: fontOK("--font-headline", "Akaya Kanadaka")');
    expect(script).toContain("headlineFont: raw.headlineFont");
    expect(script).toContain('face.status === "loaded"');
    expect(script).not.toMatch(/fraunces/i);
  });
});
