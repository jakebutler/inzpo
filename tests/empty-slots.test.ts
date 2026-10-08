import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { PaletteBands } from "@/app/components/PaletteBands";
import { BandStripe } from "@/app/components/BandStripe";
import { KitCard } from "@/app/components/KitCard";
import { ContrastAa } from "@/app/components/ContrastAa";
import { emptyRoles } from "@/lib/tokens";
import { EMPTY_ROLE_COPY } from "@/lib/brief-copy";
import { pageChromeColors, contrastRatio } from "@/lib/contrast";
import { BAND_H_EDITOR, BAND_H_RESULT } from "@/lib/brand";

describe("empty slot UI", () => {
  it.each(["result", "editor"] as const)("keeps %s heights and opens the requested empty role", (size) => {
    const roles = { ...emptyRoles(), background: "#7caed5", text: "#334559" };
    const chrome = pageChromeColors(roles);
    const onPick = vi.fn();
    const tree = PaletteBands({ roles, size, pageBackground: chrome.background, pageInk: chrome.ink, onPick });
    const { document } = parseHTML(renderToStaticMarkup(tree));
    const empty = document.querySelector('[data-role="accent"]')!;
    expect(empty.tagName).toBe("BUTTON");
    expect(empty.classList.contains("inzpo-band-empty")).toBe(true);
    expect(empty.textContent).toBe(EMPTY_ROLE_COPY("accent"));
    expect(empty.getAttribute("aria-label")).toBe(EMPTY_ROLE_COPY("accent"));
    expect(empty.getAttribute("style")).toContain(`height:${size === "editor" ? BAND_H_EDITOR : BAND_H_RESULT}px`);
    expect(contrastRatio(chrome.ink, chrome.background)).toBeGreaterThanOrEqual(4.5);
    expect(document.querySelectorAll("[data-auto]")).toHaveLength(0);
    const buttons = tree.props.children as Array<ReactElement<{ "data-role": string; onClick: () => void }>>;
    buttons.find((button) => button.props["data-role"] === "accent")!.props.onClick();
    expect(onPick).toHaveBeenCalledExactlyOnceWith("accent");
  });

  it("keeps four wall slots empty when a kit has two real colours", () => {
    const roles = { ...emptyRoles(), background: "#123456", text: "#abcdef" };
    const { document } = parseHTML(renderToStaticMarkup(createElement(BandStripe, { roles, title: "Two colours" })));
    expect(document.querySelectorAll(".inzpo-band-empty")).toHaveLength(4);
    expect(document.querySelectorAll(".inzpo-band:not(.inzpo-band-empty)")).toHaveLength(2);
  });

  it("renders an unnamed empty card with a fallback and six empty slots", () => {
    const { document } = parseHTML(renderToStaticMarkup(createElement(KitCard, { title: "IMG_6208", imageSrc: "photo.jpg" })));
    expect(document.querySelector("[data-title-skeleton]")).toBeNull();
    expect(document.querySelector("img")?.getAttribute("alt")).toBe("Gray");
    expect(document.querySelectorAll(".inzpo-band-empty")).toHaveLength(6);
    expect(document.body.textContent).not.toContain("Untitled kit");
  });

  it("asks for missing contrast roles without manufacturing either colour", () => {
    const html = renderToStaticMarkup(createElement(ContrastAa, { roles: emptyRoles() }));
    expect(html).toContain("Needs text and background colors to check contrast.");
    expect(html).not.toContain("AA pass");
  });
});
