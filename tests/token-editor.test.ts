import { createElement, act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { sampledColors } from "@/lib/derived-roles";
import type { NamedColor } from "@/lib/brief-copy";
import { photoBackZone, pinPlacement } from "@/lib/cover-pin";

const mocks = vi.hoisted(() => ({ save: vi.fn(), sheet: null as ReactNode, pixel: vi.fn(), average: vi.fn(), drag: vi.fn() }));
vi.mock("@/app/actions/tokens", () => ({ saveItemTokensAction: mocks.save }));
vi.mock("@/lib/client-eyedropper", () => ({ sampleImagePixel: mocks.pixel, sampleImageAverage: mocks.average }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetContent: ({ children }: { children: ReactNode }) => { mocks.sheet = children; return children; },
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
}));
import { TokenEditor } from "@/app/components/TokenEditor";
import { KitResult } from "@/app/components/KitResult";

type Row = { role: ColorRole; hex: string; pinX?: number; pinY?: number; origin: string };
let root: Root;
let photo: HTMLImageElement;
let window: ReturnType<typeof parseHTML>["window"];

// Read handlers from the rendered sheet to exercise controlled inputs without
// depending on linkedom's incomplete native input/focus event implementation.
function control(predicate: (props: Record<string, any>) => boolean, tree = mocks.sheet): ReactElement<any> {
  for (const child of Array.isArray(tree) ? tree : [tree]) {
    if (!child || typeof child !== "object" || !("props" in child)) continue;
    const node = child as ReactElement<any>;
    if (predicate(node.props)) return node;
    try { return control(predicate, node.props.children); } catch { /* search the next sibling */ }
  }
  throw new Error("Missing editor control");
}

beforeEach(() => {
  vi.clearAllMocks();
  const dom = parseHTML("<html><body><div data-photo-fold><img id='photo'><span data-pin-hit='primary'></span><span data-pin-hit='secondary'></span><a data-photo-back><span id='back-icon'></span></a></div><div id='root'></div></body></html>");
  window = dom.window;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("navigator", { userAgent: "vitest" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  photo = dom.document.getElementById("photo") as unknown as HTMLImageElement;
  Object.defineProperties(photo, { naturalWidth: { value: 1000 }, naturalHeight: { value: 1000 } });
  photo.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 100 }) as DOMRect;
  photo.setPointerCapture = vi.fn();
  photo.hasPointerCapture = () => false;
  photo.releasePointerCapture = vi.fn();
  mocks.save.mockResolvedValue(undefined);
  mocks.pixel.mockImplementation((_img, nx, ny) => ({ hex: "#abcdef", pinX: nx, pinY: ny }));
  mocks.average.mockImplementation((_img, nx, ny) => ({ hex: "#abcdef", pinX: nx, pinY: ny }));
  root = createRoot(dom.document.getElementById("root") as unknown as HTMLElement);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

async function render(colors: Row[], initialOpen: ColorRole | null = "primary", showContrast = false, suggestions?: { namedColors: NamedColor[]; children: ReactNode }) {
  await act(async () => root.render(createElement(TokenEditor, {
    itemId: "kit", imageSrc: "photo.jpg", colors, initialOpen, showContrast,
    photoRef: { current: photo }, crop: { vx: 0, vy: 0, vw: 1, vh: 1 },
    onPinDrag: mocks.drag,
    ...suggestions,
  })));
}

function saved() {
  const fd = mocks.save.mock.calls.at(-1)![0] as FormData;
  return { roles: JSON.parse(fd.get("roles") as string), pins: JSON.parse(fd.get("pins") as string), origins: JSON.parse(fd.get("origins") as string) };
}

async function typeHex(value: string) {
  await act(async () => control((p) => p.id === "token-hex").props.onChange({ target: { value } }));
  await act(async () => control((p) => p.id === "token-hex").props.onBlur());
}

async function pointer(type: string, clientX: number, clientY: number, target: Element = photo) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, clientY, pointerId: 1, isPrimary: true, button: 0 });
  await act(async () => { target.dispatchEvent(event); });
  return event;
}

describe("token editor with real and empty roles", () => {
  it("fixes with the best real colour, saves its pin, and undoes through the editor", async () => {
    const colors: Row[] = [
      { role: "background", hex: "#79acd3", origin: "region", pinX: 0.2, pinY: 0.3 },
      { role: "text", hex: "#384a5d", origin: "region", pinX: 0.7, pinY: 0.8 },
      { role: "primary", hex: "#252525", origin: "region", pinX: 0.4, pinY: 0.6 },
    ];
    await render(colors, "text", true);
    const sample = () => document.querySelector<HTMLElement>("[data-contrast-sample]")!;
    expect(sample().style.color).toBe("#384a5d");
    expect(document.querySelector("[data-contrast-line]")!.textContent).toContain("3.8:1Below AAFix");
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Fix text contrast"]')!.click());
    expect(saved()).toMatchObject({ roles: { text: "#252525" }, origins: { text: "fix" }, pins: { text: { pinX: 0.4, pinY: 0.6 } } });
    expect(sample().style.color).toBe("#252525");
    expect(document.querySelector("[data-contrast-line]")!.textContent).toContain("AA");
    expect(document.querySelector('[aria-label="Fix text contrast"]')).toBeNull();
    expect(control((p) => p.id === "token-hex").props.value).toBe("#252525");
    await act(async () => control((p) => p.children === "Undo").props.onClick());
    expect(saved()).toMatchObject({ roles: { text: "#384a5d" }, origins: { text: "region" }, pins: { text: { pinX: 0.7, pinY: 0.8 } } });
    expect(sample().style.color).toBe("#384a5d");
    expect(document.querySelector('[aria-label="Fix text contrast"]')).not.toBeNull();
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it("removes the old text pin for an ink fallback, and retains the fix on reload", async () => {
    await render([
      { role: "background", hex: "#79acd3", origin: "region", pinX: 0.2, pinY: 0.3 },
      { role: "text", hex: "#384a5d", origin: "region", pinX: 0.7, pinY: 0.8 },
    ], "text", true);
    const button = document.querySelector<HTMLButtonElement>('[aria-label="Fix text contrast"]')!;
    expect(button.className).toContain("min-h-11 min-w-11");
    await act(async () => button.click());
    expect(saved()).toMatchObject({ roles: { text: "#1c1b19" }, origins: { text: "fix" } });
    expect(saved().pins).toEqual({ background: { pinX: 0.2, pinY: 0.3 } });
    expect(sampledColors([{ role: "text", hex: "#1c1b19", origin: "fix", pinX: null, pinY: null }])).toHaveLength(1);
    // Further manual edits still use the normal save path; undo restores fix provenance.
    await typeHex("#202020");
    expect(saved().origins.text).toBe("sampled");
    await act(async () => control((p) => p.children === "Undo").props.onClick());
    expect(saved()).toMatchObject({ roles: { text: "#1c1b19" }, origins: { text: "fix" } });
  });

  it("leaves a legacy padded role empty and drops its old pin when the user fills it", async () => {
    await render([
      { role: "background", hex: "#123456", pinX: 0.2, pinY: 0.3, origin: "region" },
      { role: "primary", hex: "#abcdef", pinX: 0.21, pinY: 0.31, origin: "extracted" },
    ]);
    expect(control((p) => p.id === "token-hex").props.value).toBe("");
    await typeHex("#ff0000");
    expect(saved()).toMatchObject({ roles: { primary: "#ff0000", background: "#123456", accent: null }, origins: { primary: "sampled", background: "region" } });
    expect(saved().pins).toEqual({ background: { pinX: 0.2, pinY: 0.3 } });
  });

  it("saves manual hex in an empty role without a pin as sampled, and skips unchanged saves", async () => {
    await render([]);
    await typeHex("#ABCDEF");
    expect(saved()).toEqual({
      roles: { primary: "#abcdef", secondary: null, accent: null, background: null, surface: null, text: null },
      pins: {}, origins: { primary: "sampled" },
    });
    expect(sampledColors([{ role: "primary", hex: "#abcdef", origin: "sampled", pinX: null, pinY: null }])).toHaveLength(1);
    await typeHex("#ABCDEF");
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.pixel).not.toHaveBeenCalled();
  });

  it("swaps pins and provenance with roles, then removes the cleared pin", async () => {
    await render([
      { role: "primary", hex: "#123456", pinX: 0.2, pinY: 0.3, origin: "region" },
      { role: "secondary", hex: "#abcdef", pinX: 0.7, pinY: 0.8, origin: "sampled" },
    ]);
    await act(async () => control((p) => p.role === "radio" && p.children === "secondary").props.onClick());
    expect(saved()).toMatchObject({
      roles: { primary: "#abcdef", secondary: "#123456", accent: null },
      pins: { primary: { pinX: 0.7, pinY: 0.8 }, secondary: { pinX: 0.2, pinY: 0.3 } },
      origins: { primary: "sampled", secondary: "region" },
    });
    await act(async () => control((p) => p.children === "Clear this role").props.onClick());
    expect(saved().roles.secondary).toBeNull();
    expect(saved().pins).toEqual({ primary: { pinX: 0.7, pinY: 0.8 } });
  });

  it("preserves the pointer stream across loupe renders, reverts cancel and jitter, and samples a real drop", async () => {
    await render([{ role: "primary", hex: "#123456", pinX: 0.2, pinY: 0.3, origin: "region" }]);
    const listen = vi.spyOn(photo, "addEventListener");
    const nativeDrag = new window.Event("dragstart", { cancelable: true });
    photo.dispatchEvent(nativeDrag);
    expect(nativeDrag.defaultPrevented).toBe(true);
    expect((await pointer("pointerdown", 30, 50)).defaultPrevented).toBe(true);
    await pointer("pointermove", 70, 80);
    await pointer("pointercancel", 70, 80);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(control((p) => p.id === "token-hex").props.value).toBe("#123456");
    await pointer("pointerdown", 30, 50);
    await pointer("pointerup", 33, 50);
    expect(mocks.save).not.toHaveBeenCalled();
    await pointer("pointerdown", 30, 50);
    await pointer("pointermove", 70, 80);
    await pointer("pointerup", 0, 0);
    expect(saved()).toMatchObject({ roles: { primary: "#abcdef", accent: null }, pins: { primary: { pinX: 0.6, pinY: 0.6 } }, origins: { primary: "sampled" } });
    expect(mocks.pixel).toHaveBeenCalledTimes(1);
    expect(listen.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(0);
  });

  it.each([null, "secondary"] as const)("grabs a displaced disc from open=%s, preserves its true pin on no-op, and samples the release", async (initialOpen) => {
    await render([
      { role: "primary", hex: "#123456", pinX: 0.2, pinY: 0.03, origin: "region" },
      { role: "secondary", hex: "#654321", pinX: 0.8, pinY: 0.8, origin: "region" },
    ], initialOpen);
    const hit = document.querySelector('[data-pin-hit="primary"]')!;
    const placement = pinPlacement(20, 3, 100, 100, photoBackZone());
    const start = { x: placement.disc.x + 10, y: placement.disc.y + 20 };
    expect(placement.displaced).toBe(true);
    expect((await pointer("pointerdown", start.x, start.y, hit)).defaultPrevented).toBe(true);
    expect(photo.setPointerCapture).toHaveBeenCalledWith(1);
    expect(mocks.drag).toHaveBeenLastCalledWith({ role: "primary", ...placement.disc });
    await pointer("pointermove", 90, 90);
    expect(mocks.drag).toHaveBeenLastCalledWith({ role: "primary", x: 80, y: 70 });
    await pointer("pointerup", start.x + 3, start.y + 2);
    expect(mocks.drag).toHaveBeenLastCalledWith(null);
    expect(mocks.save).not.toHaveBeenCalled(); // Within 4px of press, far from true point.
    expect(mocks.pixel).not.toHaveBeenCalled();
    expect(control((p) => p.id === "token-hex").props.value).toBe("#123456");
    // Exact out-and-back also preserves everything, including the true sample.
    await pointer("pointerdown", start.x, start.y, hit);
    await pointer("pointermove", 90, 90);
    await pointer("pointerup", start.x, start.y);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.pixel).not.toHaveBeenCalled();
    await pointer("pointerdown", start.x, start.y, hit);
    await pointer("pointermove", 50, 55);
    await pointer("pointerup", 60, 70);
    expect(mocks.pixel).toHaveBeenLastCalledWith(photo, 0.5, 0.5);
    expect(saved()).toMatchObject({
      roles: { primary: "#abcdef", secondary: "#654321" },
      pins: { primary: { pinX: 0.5, pinY: 0.5 } }, origins: { primary: "sampled" },
    });
    // Undo proves that no-op gestures preserved the original source pin/hex/origin.
    await act(async () => control((p) => p.children === "Undo").props.onClick());
    expect(saved()).toMatchObject({
      roles: { primary: "#123456" }, pins: { primary: { pinX: 0.2, pinY: 0.03 } }, origins: { primary: "region" },
    });
  });

  it("leaves Back and its icon usable while the editor is open", async () => {
    await render([{ role: "primary", hex: "#123456", pinX: 0.2, pinY: 0.03, origin: "region" }]);
    const back = document.querySelector("[data-photo-back]")!;
    const received = vi.fn();
    back.addEventListener("pointerdown", received);
    const event = await pointer("pointerdown", 30, 40, document.querySelector("#back-icon")!);
    expect(received).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
    expect(photo.setPointerCapture).not.toHaveBeenCalled();
    await pointer("pointerup", 30, 40, back);
    expect(mocks.pixel).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("Add suggestions need an empty slot", () => {
  const fullKit = COLOR_ROLES.map((role, i) => ({ role, hex: `#12345${i}`, origin: "sampled" }));
  const suggestions = {
    namedColors: [{ hex: "#b9cfe2", label: "blue window pane", source: "region" }],
    children: createElement("p", { "data-brief-text": true }, "A blue window pane."),
  };

  it.each([
    { provenance: {}, visible: false },
    { provenance: { pinX: 0.2, pinY: 0.3 }, visible: false },
    { provenance: { source: "region" }, visible: true },
    { provenance: { source: "region", pinX: 0.2, pinY: 0.3 }, visible: true },
    { provenance: { source: "model", pinX: 0.2, pinY: 0.3 }, visible: false },
    { provenance: { source: "unknown" }, visible: false },
  ])("renders only suggestions with the region marker ($provenance)", async ({ provenance, visible }) => {
    await render([], null, false, {
      ...suggestions, namedColors: [{ hex: "#b9cfe2", label: "blue window pane", ...provenance }],
    });
    const chip = document.querySelector("[data-named-chip]");
    expect(Boolean(chip)).toBe(visible);
    if (visible) expect(chip?.getAttribute("data-chip-source")).toBe("region");
  });

  it.each([
    { source: undefined, expectedCount: 0 },
    { source: "region", expectedCount: 1 },
  ])("filters saved-kit chips with pins and source=$source", ({ source, expectedCount }) => {
    const html = renderToStaticMarkup(createElement(KitResult, {
      itemId: "saved-kit", title: "Blue window", imageSrc: null, width: 390, height: 488,
      colors: [], tileSrc: null, saved: true,
      preview: {
        status: "ready", text: "A blue window pane.", reveal: "landed",
        namedColors: [{ hex: "#b9cfe2", label: "blue window pane", pinX: 0.2, pinY: 0.3, ...(source ? { source } : {}) }],
      },
    }));
    const { document } = parseHTML(html);
    expect(document.querySelector("[data-saved-header]")).not.toBeNull();
    expect(document.querySelectorAll("[data-named-chip]")).toHaveLength(expectedCount);
  });

  it.each([0, 1, 3, 6])("shows Add suggestions only with empty roles (%s empty)", async (emptyCount) => {
    await render(fullKit.slice(emptyCount), null, false, suggestions);
    expect(document.querySelectorAll("[data-named-chip]")).toHaveLength(emptyCount > 0 ? 1 : 0);
    expect(document.querySelector("[data-brief-text]")?.textContent).toBe("A blue window pane.");
    if (emptyCount > 0) expect(document.querySelector("[data-named-chip] button")?.textContent).toBe("Add");
  });

  it("hides suggestions as the last empty role fills and restores them when a role is cleared", async () => {
    await render(fullKit.slice(1), "primary", false, suggestions);
    expect(document.querySelectorAll("[data-named-chip]")).toHaveLength(1);
    await typeHex("#ff0000");
    expect(document.querySelectorAll("[data-named-chip]")).toHaveLength(0);
    await act(async () => control((p) => p.children === "Clear this role").props.onClick());
    expect(document.querySelectorAll("[data-named-chip]")).toHaveLength(1);
    expect(document.querySelector("[data-brief-text]")?.textContent).toBe("A blue window pane.");
  });
});
