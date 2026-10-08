import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INK, PAPER } from "@/lib/brand";
import { bandLabelColor, gatedTextColor } from "@/lib/contrast";
import { rolesFromColors } from "@/lib/tokens";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/tokens", () => ({ saveItemTokensAction: mocks.save }));
vi.mock("@/app/actions/collections", () => ({ addToCollectionAndReturnId: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: (props: object) => createElement("a", props) }));
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn(), fromTo: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/app/components/Mascot", () => ({ Mascot: () => null }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) => open ? children : null,
  SheetContent: ({ children, style }: { children: ReactNode; style: object }) => createElement("div", { "data-test-sheet": true, style }, children),
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
}));
import { KitChrome } from "@/app/components/KitChrome";
import { KitResult } from "@/app/components/KitResult";
import { SaveBar } from "@/app/components/SaveBar";

let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  Object.defineProperty(window, "localStorage", { configurable: true, value: { getItem: () => null } });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", { userAgent: "vitest" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = createRoot(document.getElementById("root")! as unknown as HTMLElement);
  mocks.save.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

async function render(background: string, text: string, saveSheetOpen = false) {
  const colors = [
    { role: "background" as const, hex: background, position: 0, origin: "region", pinX: 0.2, pinY: 0.3 },
    { role: "text" as const, hex: text, position: 1, origin: "region", pinX: 0.7, pinY: 0.8 },
  ];
  await act(async () => root.render(createElement(KitChrome, { roles: rolesFromColors(colors), children: [
    createElement(KitResult, {
      key: "result", itemId: "kit", title: "Blue house", imageSrc: null, width: 390, height: 488,
      colors, tileSrc: "texture.jpg", saved: true,
      preview: { status: "ready", text: "Blue shade.", reveal: "landed" },
    }),
    createElement(SaveBar, { key: "save", itemId: "kit", collections: [{ id: "c", name: "Walks" }], saved: true, defaultOpen: saveSheetOpen }),
  ] })));
  return colors;
}

function effectiveColor(node: HTMLElement): string {
  // linkedom does not compute CSS inheritance; resolve our foreground utility
  // and inline colours against the actual rendered kit CSS variables.
  const utility = node.classList.contains("text-foreground");
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    if (utility && current.style.getPropertyValue("--foreground")) return current.style.getPropertyValue("--foreground");
    if (!utility && current.style.color) return current.style.color;
  }
  throw new Error("Missing kit foreground");
}

describe("kit surface copy and honest Aa sample", () => {
  it.each([
    { background: "#79acd3", text: "#384a5d", expected: INK, label: "fail" },
    { background: "#202020", text: "#384a5d", expected: PAPER, label: "fail" },
    { background: "#f3eee4", text: "#384a5d", expected: "#384a5d", label: "AA pass" },
  ])("shares the gate for copy on $background while Aa uses the real $text", async ({ background, text, expected, label }) => {
    const colors = await render(background, text);
    expect(expected).toBe(gatedTextColor(text, background));
    for (const selector of [
      "[data-brief-text]", "[data-saved-caption]", "[data-saved-header]", "[data-saved-header] h1",
      "[data-save-bar] a", '[data-role="accent"]', "[data-contrast-line]", "[data-contrast-line] .font-mono",
      '[data-export-path=""]',
    ]) {
      expect(effectiveColor(document.querySelector<HTMLElement>(selector)!), selector).toBe(expected);
    }
    const band = document.querySelector<HTMLElement>('[data-role="background"]')!;
    expect(band.style.color).toBe(bandLabelColor(background, rolesFromColors(colors)));
    const sample = document.querySelector<HTMLElement>("[data-contrast-sample]")!;
    expect(sample.style.color).toBe(text);
    expect(sample.parentElement!.style.backgroundColor).toBe(background);
    expect(sample.parentElement!.textContent).toContain(label);
    expect(document.querySelector('[aria-label="Fix text contrast"]') !== null).toBe(label === "fail");
    expect(document.querySelector("[data-brief-text]")!.className).toContain("text-[18px]");
  });

  it("gates the portalled collection sheet, including its selected row on a dark kit", async () => {
    await render("#202020", "#384a5d", true);
    const sheet = document.querySelector<HTMLElement>("[data-save-bar] [data-test-sheet]")!;
    expect(sheet.style.color).toBe(PAPER);
    expect(sheet.style.backgroundColor).toBe("#202020");
    expect(sheet.style.getPropertyValue("--foreground")).toBe(PAPER);
    const selected = Array.from(sheet.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Walks")!;
    expect(selected.style.color).toBe("var(--background)");
    expect(selected.style.backgroundColor).toBe("var(--foreground)");
  });

  it("updates brief, header, links and save bar through fix, manual edit and editor undo", async () => {
    await render("#79acd3", "#384a5d");
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Fix text contrast"]')!.click());
    expect(document.querySelector("[data-contrast-line]")!.textContent).toContain("7.1:1AA pass");
    expect(document.querySelector('[aria-label="Fix text contrast"]')).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[data-role="text"]')!.click());
    const input = document.querySelector<HTMLInputElement>("#token-hex")!;
    const propsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"))!;
    const props = (input as unknown as Record<string, { onChange: (event: object) => void }>)[propsKey]!;
    await act(async () => props.onChange({ target: { value: "#303030" } }));
    await act(async () => input.dispatchEvent(new window.Event("focusout", { bubbles: true })));
    for (const selector of ["[data-brief-text]", "[data-saved-header]", "[data-save-bar] a"]) {
      expect(effectiveColor(document.querySelector<HTMLElement>(selector)!)).toBe("#303030");
    }
    expect(document.querySelector<HTMLElement>("[data-test-sheet]")!.style.color).toBe("#303030");
    const undo = () => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Undo")!;
    await act(async () => undo().click());
    expect(document.querySelector<HTMLElement>("[data-brief-text]")!.style.color).toBe("#1c1b19");
    await act(async () => undo().click());
    expect(document.querySelector("[data-contrast-line]")!.textContent).toContain("3.8:1failFix");
    expect(document.querySelector<HTMLElement>("[data-brief-text]")!.style.color).toBe(INK);
    expect(document.querySelector<HTMLElement>("[data-test-sheet]")!.style.color).toBe(INK);
    expect(mocks.save).toHaveBeenCalledTimes(4);
  });
});
