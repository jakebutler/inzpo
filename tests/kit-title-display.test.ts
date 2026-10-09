import { act, createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kitDisplayName, UNTITLED_KIT } from "@/lib/kit-name";
import { STALE_PENDING_MS, type BriefState } from "@/lib/brief-state";
import { contrastRatio } from "@/lib/contrast";
import { PAPER } from "@/lib/brand";
import { KitChrome } from "@/app/components/KitChrome";
import { emptyRoles } from "@/lib/tokens";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn(), retry: undefined as (() => void) | undefined }));
vi.mock("next/navigation", () => {
  const router = { refresh: mocks.refresh };
  return { useRouter: () => router };
});
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode; href: string }) => createElement("a", props, children) }));
vi.mock("@/app/components/ExportKitButton", () => ({ ExportKitButton: () => createElement("button", null, "Export kit") }));
vi.mock("@/app/components/TokenEditor", () => ({ TokenEditor: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/app/components/BriefSlot", () => ({
  BriefSlot: ({ status, onRetry }: { status: string; onRetry: () => void }) => {
    mocks.retry = onRetry;
    return createElement("div", { "data-slot-status": status });
  },
}));

import { KitCard } from "@/app/components/KitCard";
import { BandStripe } from "@/app/components/BandStripe";
import { SavedKitHeader } from "@/app/components/SavedKitHeader";
import { KitResult } from "@/app/components/KitResult";

const now = 1_800_000_000_000;
const roles = { ...emptyRoles(), primary: "#3f5e92" };
const cases: Array<{ label: string; brief: BriefState | null; title: string | null; name: string }> = [
  { label: "recent pending", brief: { status: "pending", updatedAt: now }, title: null, name: "" },
  { label: "stale pending", brief: { status: "pending", updatedAt: now - STALE_PENDING_MS }, title: "IMG_6208", name: "Blue" },
  { label: "failed / timed out", brief: { status: "failed", updatedAt: now }, title: "IMG_6208", name: "Blue" },
  { label: "stub", brief: { status: "ready", updatedAt: now, stub: true }, title: null, name: "Blue" },
  { label: "ready with title", brief: { status: "ready", updatedAt: now }, title: "Storefront Blue", name: "Storefront Blue" },
  { label: "ready without title", brief: { status: "ready", updatedAt: now }, title: null, name: "Blue" },
  { label: "missing job", brief: null, title: null, name: "Blue" },
  { label: "missing pending timestamp", brief: { status: "pending", updatedAt: 0 }, title: null, name: "Blue" },
  { label: "legacy untitled", brief: { status: "failed", updatedAt: now }, title: UNTITLED_KIT, name: "Blue" },
];

describe("kit title placeholders", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());

  it.each(["Cream Victorian", "Victorian House Cream", "Mural Red", "My favourite blue house palette"])("wraps the saved header name %s without ellipsis", (title) => {
    const { document } = parseHTML(renderToStaticMarkup(createElement(SavedKitHeader, {
      title, itemId: "kit", primaryHex: roles.primary, backHref: "/",
    })));
    const heading = document.querySelector("h1")!;
    expect(heading.textContent).toBe(title);
    expect(heading.classList.contains("truncate")).toBe(false);
    expect(heading.className).not.toMatch(/line-clamp|overflow-hidden/);
    expect(heading.classList.contains("whitespace-normal")).toBe(true);
    expect(heading.classList.contains("break-words")).toBe(true);
    expect(heading.classList.contains("text-balance")).toBe(true);
    expect(heading.classList.contains("min-w-0")).toBe(true);
    expect(heading.classList.contains("flex-1")).toBe(true);
    expect(heading.classList.contains("text-[22px]")).toBe(true);
    expect(heading.classList.contains("leading-7")).toBe(true);
    expect(document.querySelector("header")?.classList.contains("items-center")).toBe(true);
    expect(document.querySelector("a")?.classList.contains("shrink-0")).toBe(true);
    expect(document.querySelector("button")?.textContent).toBe("Export kit");
    expect(document.querySelector("button")?.parentElement?.classList.contains("shrink-0")).toBe(true);
  });

  it("wraps kit captions shared by Wall, collection and recent cards", () => {
    const title = "Victorian House Cream";
    for (const view of [
      createElement(KitCard, { title, roles, imageSrc: "photo.jpg" }),
      createElement(BandStripe, { title, roles }),
    ]) {
      const { document } = parseHTML(renderToStaticMarkup(view));
      const caption = document.querySelector("figcaption")!;
      expect(caption.textContent).toBe(title);
      expect(caption.className).not.toMatch(/truncate|line-clamp|overflow-hidden/);
      expect(caption.classList.contains("whitespace-normal")).toBe(true);
      expect(caption.classList.contains("break-words")).toBe(true);
      expect(caption.classList.contains("text-balance")).toBe(true);
    }
  });

  it("keeps board and library kit titles free of truncation and line clamps", () => {
    for (const file of ["app/boards/[id]/BoardEditor.tsx", "app/boards/[id]/LibraryPicker.tsx"]) {
      const source = readFileSync(file, "utf8");
      const titles = source.split("\n").filter((line) => /\{(?:p|row)\.title \?\?/.test(line) && line.includes("className="));
      expect(titles.length).toBeGreaterThan(0);
      for (const title of titles) {
        expect(title).not.toMatch(/truncate|line-clamp/);
        expect(title).toContain("whitespace-normal break-words text-balance");
      }
    }
  });

  it.each(cases)("renders $label in the saved header", ({ brief, title, name }) => {
    expect(kitDisplayName({ title, primaryHex: roles.primary, brief })).toBe(name);
    const views = [
      createElement(SavedKitHeader, { title, primaryHex: roles.primary, brief, backHref: "/" }),
    ];
    for (const view of views) {
      const { document } = parseHTML(renderToStaticMarkup(view));
      const caption = document.querySelector("figcaption, h1")!;
      expect(caption.querySelector("[data-title-pending]") !== null).toBe(name === "");
      expect(caption.textContent).toBe(name || "Naming it…");
      if (!name) {
        const pending = caption.querySelector("[data-title-pending]")!;
        expect(pending.classList.contains("opacity-60")).toBe(false);
        expect(contrastRatio((pending as HTMLElement).style.color, PAPER)).toBeGreaterThanOrEqual(4.5);
        expect(caption.classList.contains("font-heading")).toBe(true);
        expect(caption.className + pending.className).not.toContain("italic");
        expect(pending.hasAttribute("aria-hidden")).toBe(false);
      }
      expect(caption.textContent).not.toMatch(/Untitled kit|IMG_6208/);
      if (document.querySelector("img")) expect(document.querySelector("img")?.getAttribute("alt")).toBe(name);
    }
  });

  it.each([
    { label: "recent null title", title: null, createdAt: new Date(now), name: "" },
    { label: "recent camera filename", title: "IMG_6208", createdAt: new Date(now - 59_999).toISOString(), name: "" },
    { label: "recent legacy untitled", title: UNTITLED_KIT, createdAt: new Date(now), name: "" },
    { label: "60s boundary", title: null, createdAt: new Date(now - 60_000), name: "Blue" },
    { label: "older than 60s", title: "IMG_6208", createdAt: new Date(now - 60_001), name: "Blue" },
    { label: "missing timestamp", title: null, createdAt: undefined, name: "Blue" },
    { label: "invalid timestamp", title: null, createdAt: "invalid", name: "Blue" },
    { label: "recent user title", title: "My photo", createdAt: new Date(now), name: "My photo" },
    { label: "recent persisted fallback", title: "Blue", createdAt: new Date(now), name: "Blue" },
  ])("uses item age without a brief job for $label in cards and bands", ({ title, createdAt, name }) => {
    expect(kitDisplayName({ title, primaryHex: roles.primary, createdAt })).toBe(name);
    const views = [
      createElement(KitCard, { title, roles, createdAt, imageSrc: "photo.jpg" }),
      createElement(BandStripe, { title: title ?? "", roles, createdAt }),
    ];
    for (const view of views) {
      const { document } = parseHTML(renderToStaticMarkup(view));
      const caption = document.querySelector("figcaption")!;
      expect(caption.querySelector("[data-title-pending]") !== null).toBe(name === "");
      expect(caption.textContent).toBe(name || "Naming it…");
      if (!name) {
        const pending = caption.querySelector("[data-title-pending]")!;
        expect(pending.classList.contains("opacity-60")).toBe(false);
        expect(contrastRatio((pending as HTMLElement).style.color, PAPER)).toBeGreaterThanOrEqual(4.5);
        expect(caption.classList.contains("font-heading")).toBe(true);
        expect(caption.className + pending.className).not.toContain("italic");
        expect(pending.hasAttribute("aria-hidden")).toBe(false);
      }
      expect(document.body.textContent).not.toMatch(/Untitled kit|IMG_6208/);
      if (document.querySelector("img")) expect(document.querySelector("img")?.getAttribute("alt")).toBe(name);
    }
  });

  it.each(["#426297", "#BEBEC1", "#1C1B19", "#F3EEE4", "#808080"])("keeps pending saved names at AA on kit background %s", background => {
    const { document } = parseHTML(renderToStaticMarkup(createElement(KitChrome, {
      roles: { ...roles, background },
      children: createElement(SavedKitHeader, { title: null, backHref: "/", brief: { status: "pending", updatedAt: now } }),
    })));
    const pending = document.querySelector<HTMLElement>("[data-title-pending]")!;
    const pageBackground = document.querySelector<HTMLElement>("[data-kit-wear]")!.style.backgroundColor;
    expect(contrastRatio(pending.style.color, pageBackground)).toBeGreaterThanOrEqual(4.5);
    expect(pending.className).not.toContain("opacity");
  });

  it("falls back to the first filled role and then neutral for card media", () => {
    for (const [kit, colour] of [
      [{ ...emptyRoles(), secondary: "#a0adbb" }, "#a0adbb"],
      [emptyRoles(), "var(--muted)"],
    ] as const) {
      const { document } = parseHTML(renderToStaticMarkup(createElement(KitCard, { title: null, roles: kit, imageSrc: "photo.jpg" })));
      expect(document.querySelector<HTMLElement>("[data-card-media]")!.style.backgroundColor).toBe(colour);
    }
  });

  it("reuses the first filled real role for the card fallback", () => {
    const { document } = parseHTML(renderToStaticMarkup(createElement(KitCard, {
      title: null, roles: { ...emptyRoles(), secondary: "#a0adbb", accent: "#ff0000" },
      createdAt: new Date(now - 60_000),
    })));
    expect(document.querySelector("figcaption")?.textContent).toBe("Gray");
  });

  it("uses the kit-name colour family for muted primary colours", () => {
    expect(kitDisplayName({ title: "IMG_6208", primaryHex: "#a0adbb", brief: { status: "failed", updatedAt: now } })).toBe("Gray");
    expect(kitDisplayName({ title: UNTITLED_KIT })).toBe("Untitled kit");
  });

  it.each([null, { status: "failed" as const, updatedAt: now }, { status: "pending" as const, updatedAt: now - STALE_PENDING_MS }])("uses Untitled kit without any filled role after pending ends (%j)", (brief) => {
    const { document } = parseHTML(renderToStaticMarkup(createElement(SavedKitHeader, {
      title: null, brief, backHref: "/",
    })));
    expect(document.querySelector("h1")?.textContent).toBe(UNTITLED_KIT);
    expect(document.querySelector("[data-title-pending]")).toBeNull();
  });

  it("keeps an existing title during a pending retry", () => {
    expect(kitDisplayName({ title: "My photo", brief: { status: "pending", updatedAt: now } })).toBe("My photo");
  });

  it.each(cases.filter(({ brief }) => brief && (brief.status !== "ready" || brief.stub)))("ignores leftover brief text for $label", ({ brief, name }) => {
    expect(kitDisplayName({ primaryHex: roles.primary, brief, briefText: "A yellow facade.", subject: "house" })).toBe(name);
  });
});

describe("client brief transitions", () => {
  let root: Root;
  let document: ReturnType<typeof parseHTML>["document"];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const dom = parseHTML("<html><body><div id='root'></div></body></html>");
    document = dom.document;
    dom.window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", document);
    vi.stubGlobal("navigator", { userAgent: "vitest" });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", mocks.fetch);
    root = createRoot(document.getElementById("root") as unknown as HTMLElement);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the header hairline only after window or container scrolling", async () => {
    vi.stubGlobal("window", Object.assign(window, { scrollY: 0 }));
    await act(async () => root.render(createElement(SavedKitHeader, { title: "Blue", backHref: "/" })));
    const header = document.querySelector("header")!;
    expect(header.getAttribute("data-header-scrolled")).toBe("false");
    expect(header.style.boxShadow).toBeFalsy();
    await act(async () => { window.scrollY = 200; window.dispatchEvent(new window.Event("scroll")); });
    expect(header.getAttribute("data-header-scrolled")).toBe("true");
    expect(header.style.boxShadow).toContain("0 1px 0");
    await act(async () => { window.scrollY = 0; window.dispatchEvent(new window.Event("scroll")); });
    expect(header.getAttribute("data-header-scrolled")).toBe("false");
    expect(header.style.boxShadow).toBeFalsy();
    await act(async () => { header.parentElement!.scrollTop = 200; window.dispatchEvent(new window.Event("scroll")); });
    expect(header.getAttribute("data-header-scrolled")).toBe("true");
  });

  it("prefers the uploaded photo while pending, with a coloured loading/error box", async () => {
    await act(async () => root.render(createElement(KitCard, {
      title: null, roles, createdAt: new Date(now), imageSrc: "/media/upload/w640.webp",
    })));
    const image = document.querySelector("img")!;
    const media = document.querySelector<HTMLElement>("[data-card-media]")!;
    expect(document.querySelector("[data-title-pending]")).not.toBeNull();
    expect(image.getAttribute("src")).toBe("/media/upload/w640.webp");
    expect(media.style.backgroundColor).toBe(roles.primary);
    expect(image.style.visibility).not.toBe("hidden");
    await act(async () => image.dispatchEvent(new window.Event("error")));
    expect(image.style.visibility).toBe("hidden");
    expect(media.style.backgroundColor).toBe(roles.primary);
    await act(async () => image.dispatchEvent(new window.Event("load")));
    expect(image.style.visibility).not.toBe("hidden");
  });

  it("expires a wall pending name while the page remains open", async () => {
    await act(async () => root.render(createElement(KitCard, {
      title: null, roles, createdAt: new Date(now),
    })));
    expect(document.querySelector("[data-title-pending]")).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(STALE_PENDING_MS); });
    expect(document.querySelector("[data-title-pending]")).toBeNull();
    expect(document.querySelector("figcaption")?.textContent).toBe("Blue");
  });

  it("flips the saved header on failure and replaces the fallback on retry without a reload", async () => {
    const response = (job: object) => ({ ok: true, json: async () => job });
    mocks.fetch
      .mockResolvedValueOnce(response({ status: "pending", updatedAt: now, text: null }))
      .mockResolvedValueOnce(response({ status: "failed", updatedAt: now + 2500, text: null }))
      .mockResolvedValueOnce(response({ status: "ready", title: "Storefront Blue", text: "A blue storefront.", updatedAt: now + 2500 }));
    await act(async () => root.render(createElement(KitResult, {
      itemId: "kit", title: "IMG_6208", imageSrc: null, width: 390, height: 488,
      colors: [{ hex: roles.primary!, role: "primary", position: 0, origin: "sampled" }],
      tileSrc: null, saved: true, initialBrief: { status: "pending", updatedAt: now },
    })));
    expect(document.querySelector("h1 [data-title-pending]")).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(document.querySelector("[data-slot-status]")?.getAttribute("data-slot-status")).toBe("failed");
    expect(document.querySelector("h1")?.textContent).toBe("Blue");
    expect(document.querySelector("h1 [data-title-pending]")).toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();
    await act(async () => mocks.retry?.());
    expect(mocks.fetch).toHaveBeenLastCalledWith("/api/briefs/kit?retry=1", { method: "POST" });
    expect(document.querySelector("h1")?.textContent).toBe("Storefront Blue");
  });
});
