import { createElement, act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColorRole } from "@/lib/db/schema";
import { sampledColors } from "@/lib/derived-roles";

const mocks = vi.hoisted(() => ({ save: vi.fn(), sheet: null as ReactNode, pixel: vi.fn(), average: vi.fn() }));
vi.mock("@/app/actions/tokens", () => ({ saveItemTokensAction: mocks.save }));
vi.mock("@/lib/client-eyedropper", () => ({ sampleImagePixel: mocks.pixel, sampleImageAverage: mocks.average }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => children,
  SheetContent: ({ children }: { children: ReactNode }) => { mocks.sheet = children; return children; },
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
}));
import { TokenEditor } from "@/app/components/TokenEditor";

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
  const dom = parseHTML("<html><body><img id='photo'><div id='root'></div></body></html>");
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

async function render(colors: Row[], initialOpen: ColorRole = "primary") {
  await act(async () => root.render(createElement(TokenEditor, {
    itemId: "kit", imageSrc: "photo.jpg", colors, initialOpen,
    photoRef: { current: photo }, crop: { vx: 0, vy: 0, vw: 1, vh: 1 },
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

async function pointer(type: string, clientX: number, clientY: number) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, clientY, pointerId: 1, isPrimary: true, button: 0 });
  await act(async () => { photo.dispatchEvent(event); });
  return event;
}

describe("token editor with real and empty roles", () => {
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
});
