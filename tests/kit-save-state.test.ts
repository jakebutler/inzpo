import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemDetail } from "@/lib/items";

const mocks = vi.hoisted(() => ({
  item: vi.fn(), memberships: vi.fn(), collections: vi.fn(), save: vi.fn(),
  add: vi.fn(), refresh: vi.fn(), pixel: vi.fn(),
}));
vi.mock("@/lib/items", () => ({ getItemDetail: mocks.item, getArticleHtml: vi.fn() }));
vi.mock("@/lib/item-collections", () => ({ getItemCollections: mocks.memberships, listCollectionOptions: vi.fn() }));
vi.mock("@/lib/collections", () => ({ listCollections: mocks.collections }));
vi.mock("@/lib/item-boards", () => ({ getItemBoards: vi.fn(), getBoards: vi.fn() }));
vi.mock("@/lib/palettes", () => ({ getOrigin: vi.fn(), getDerivedItems: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwnerId: async () => "owner" }));
vi.mock("@/lib/brief", () => ({ readBriefJob: async () => ({ status: "ready", updatedAt: 1 }) }));
vi.mock("@/app/actions/collections", () => ({ addToCollectionAndReturnId: mocks.add, addToCollectionAction: vi.fn(), removeFromCollectionAction: vi.fn() }));
vi.mock("@/app/actions/boards", () => ({ addItemToBoardAction: vi.fn(), createBoardWithItemAction: vi.fn(), removeItemFromBoardAction: vi.fn() }));
vi.mock("@/app/actions/palettes", () => ({ saveExtractedAsPaletteAction: vi.fn() }));
vi.mock("@/app/actions/tokens", () => ({ saveItemTokensAction: mocks.save }));
vi.mock("@/app/items/DeleteButton", () => ({ DeleteButton: () => null }));
vi.mock("@/app/components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/app/components/ExportKitButton", () => ({ ExportKitButton: () => null }));
vi.mock("@/lib/client-eyedropper", () => ({ sampleImagePixel: mocks.pixel, sampleImageAverage: mocks.pixel }));
vi.mock("next/navigation", () => {
  const router = { refresh: mocks.refresh, push: vi.fn() };
  return { useRouter: () => router, notFound: () => { throw new Error("Not found"); } };
});
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode; href: string }) => createElement("a", props, children) }));
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn(), fromTo: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetContent: ({ children }: { children: ReactNode }) => children,
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
}));

import ItemDetailPage from "@/app/items/[id]/page";

const latest = { id: "latest", name: "Window studies" };
const older = { id: "older", name: "Architecture" };
let item: ItemDetail;
let root: Root | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  item = {
    id: "kit", kind: "photo", title: "Blue window", note: null, createdAt: new Date(0),
    source: null, oembedHtml: null, hasArticle: false, origin: null, media: null,
    colors: [{ hex: "#123456", role: "primary", origin: "region", family: "blue", name: null, position: 0, pinX: 0.2, pinY: 0.3 }],
  };
  mocks.item.mockImplementation(async () => item);
  mocks.collections.mockResolvedValue([older, latest]);
  mocks.memberships.mockResolvedValue([latest, older]);
  mocks.save.mockResolvedValue(undefined);
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});

async function page(query: { c?: string; saved?: string } = {}) {
  return ItemDetailPage({ params: Promise.resolve({ id: item.id }), searchParams: Promise.resolve(query) });
}

function expectSaved(document: ReturnType<typeof parseHTML>["document"]) {
  const bar = document.querySelector("[data-save-bar]")!;
  const button = Array.from(bar.querySelectorAll("button")).find((b) => b.textContent === "Saved");
  expect(button?.hasAttribute("disabled")).toBe(true);
  expect(Array.from(bar.querySelectorAll("button")).some((b) => b.textContent === "Save" && !b.hasAttribute("disabled"))).toBe(false);
  expect(bar.querySelector("a")?.textContent).toBe("In Window studies →");
  expect(bar.querySelector("a")?.getAttribute("href")).toBe("/?c=latest");
  expect(document.querySelector("[data-saved-header]")).not.toBeNull();
}

describe("saved kit detail state", () => {
  it.each([{}, { c: "older" }, { c: "older", saved: "1" }])("uses persisted membership and the latest collection for %j", async (query) => {
    const { document } = parseHTML(renderToStaticMarkup(await page(query)));
    expectSaved(document);
    expect(mocks.memberships).toHaveBeenCalledWith("owner", "kit", "recent");
  });

  it("still offers Save on an unsaved kit", async () => {
    mocks.memberships.mockResolvedValue([]);
    const { document } = parseHTML(renderToStaticMarkup(await page()));
    const save = Array.from(document.querySelectorAll("[data-save-bar] button")).find((b) => b.textContent === "Save");
    expect(save).toBeDefined();
    expect(save?.hasAttribute("disabled")).toBe(false);
    expect(document.querySelector("[data-save-bar] a")).toBeNull();
    expect(document.querySelector("[data-saved-header]")).toBeNull();
  });

  it("preserves the post-save URL state", async () => {
    mocks.memberships.mockResolvedValue([]);
    const { document } = parseHTML(renderToStaticMarkup(await page({ c: "latest", saved: "1" })));
    expectSaved(document);
  });

  it("keeps Saved through a pin edit, autosave, and the refreshed detail page", async () => {
    const dom = parseHTML("<html><body><div id='root'></div></body></html>");
    dom.window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperties(dom.window.HTMLElement.prototype, {
      clientWidth: { configurable: true, get: () => 390 },
      clientHeight: { configurable: true, get: () => 337 },
    });
    Object.defineProperty(dom.window, "localStorage", { configurable: true, value: { getItem: () => "older" } });
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.document);
    vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
    vi.stubGlobal("getComputedStyle", () => ({ paddingTop: "0px" }));
    vi.stubGlobal("navigator", { userAgent: "vitest" });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("Image", class { decode() { return Promise.resolve(); } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ready", text: "Blue glass.", updatedAt: 1 }) }));
    item.media = { originalKey: "original", displayKey: "photo", placeholder: null, mime: "image/jpeg", width: 1000, height: 1000, tileKey: null };
    mocks.pixel.mockReturnValue({ hex: "#abcdef", pinX: 0.6, pinY: 0.6 });
    root = createRoot(dom.document.getElementById("root") as unknown as HTMLElement);
    await act(async () => root!.render(await page()));
    expectSaved(dom.document);

    const photo = dom.document.querySelector("[data-photo-fold] img") as unknown as HTMLImageElement;
    Object.defineProperties(photo, { naturalWidth: { value: 1000 }, naturalHeight: { value: 1000 } });
    photo.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 337 }) as DOMRect;
    photo.setPointerCapture = vi.fn();
    photo.hasPointerCapture = () => false;
    const hit = dom.document.querySelector('[data-pin-hit="primary"]')!;
    for (const [type, clientX, clientY] of [["pointerdown", 100, 100], ["pointermove", 200, 200], ["pointerup", 200, 200]] as const) {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { clientX, clientY, pointerId: 1, isPrimary: true, button: 0 });
      await act(async () => { hit.dispatchEvent(event); });
      expectSaved(dom.document);
    }
    expect(mocks.save).toHaveBeenCalledTimes(1);
    const fd = mocks.save.mock.calls[0][0] as FormData;
    expect(JSON.parse(fd.get("roles") as string).primary).toBe("#abcdef");
    expect(JSON.parse(fd.get("pins") as string).primary).toEqual({ pinX: 0.6, pinY: 0.6 });
    // Revalidation returns updated colors, with no saved query flag.
    item = { ...item, colors: [{ ...item.colors[0], hex: "#abcdef", pinX: 0.6, pinY: 0.6, origin: "sampled" }] };
    await act(async () => root!.render(await page()));
    expectSaved(dom.document);
    await act(async () => {
      const saved = Array.from(dom.document.querySelectorAll("[data-save-bar] button")).find((b) => b.textContent === "Saved")!;
      saved.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    });
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
