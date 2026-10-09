import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { KitResult } from "@/app/components/KitResult";
import { photoFoldHeight } from "@/lib/brand";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { PIN_MIN_SPACING_PX } from "@/lib/cover-pin";
import * as coverPins from "@/lib/cover-pin";
import { PIN_6208_COLORS } from "./fixtures/pins";

const mocks = vi.hoisted(() => ({ save: vi.fn(), pixel: vi.fn(), average: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/app/actions/tokens", () => ({ saveItemTokensAction: mocks.save }));
vi.mock("@/lib/client-eyedropper", () => ({ sampleImagePixel: mocks.pixel, sampleImageAverage: mocks.average }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? children : null,
  SheetContent: ({ children }: { children: ReactNode }) => createElement("div", { role: "dialog" }, children),
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => createElement("h2", null, children),
}));

async function mount(width: number, height: number, openRole: ColorRole | null) {
  vi.clearAllMocks();
  const { window, document } = parseHTML("<html><body><div id='root'></div></body></html>");
  const photoH = photoFoldHeight(height);
  // Crop recorded immediately before the live 6208 mouse drop 5.
  const cropSpy = vi.spyOn(coverPins, "coverWindowForPins").mockReturnValue({
    vx: 0, vy: 0.2475479711538461, vw: 1, vh: photoH / (width / 0.75),
  });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  vi.stubGlobal("window", window);
  vi.stubGlobal("self", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("getComputedStyle", () => ({ paddingTop: "0px", opacity: "1" }));
  vi.stubGlobal("Image", class { decode() { return Promise.resolve(); } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  mocks.save.mockResolvedValue(undefined);
  mocks.average.mockReturnValue({ hex: "#919ba1" });
  mocks.pixel.mockImplementation((_img, nx, ny) => ({
    hex: nx < 0.01 ? "#3b4c60" : "#919ba1", pinX: nx, pinY: ny,
  }));
  const proto = window.HTMLElement.prototype;
  const originalWidth = Object.getOwnPropertyDescriptor(proto, "clientWidth");
  const originalHeight = Object.getOwnPropertyDescriptor(proto, "clientHeight");
  const originalRect = proto.getBoundingClientRect;
  Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => width });
  Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => photoH });
  proto.getBoundingClientRect = function () {
    const role = this.getAttribute("data-role");
    const top = role ? photoH + COLOR_ROLES.indexOf(role as ColorRole) * 40
      : this.hasAttribute("data-band-stack") ? photoH : 0;
    const h = role ? 40 : this.hasAttribute("data-band-stack") ? 240 : photoH;
    return { x: 0, y: top, left: 0, top, right: width, bottom: top + h, width, height: h } as DOMRect;
  };
  const root = createRoot(document.getElementById("root")!);
  const cleanup = async () => {
    await act(async () => root.unmount());
    if (originalWidth) Object.defineProperty(proto, "clientWidth", originalWidth);
    else Reflect.deleteProperty(proto, "clientWidth");
    if (originalHeight) Object.defineProperty(proto, "clientHeight", originalHeight);
    else Reflect.deleteProperty(proto, "clientHeight");
    proto.getBoundingClientRect = originalRect;
    cropSpy.mockRestore();
    vi.unstubAllGlobals();
  };
  try {
    await act(async () => root.render(createElement(KitResult, {
      itemId: "6208", title: "Blue storefront", imageSrc: "/photo.jpg", tileSrc: null,
      width: 1500, height: 2000, colors: [...PIN_6208_COLORS].reverse(),
      preview: { reveal: "landed", openRole, loupe: true },
    })));
  } catch (error) {
    await cleanup();
    throw error;
  }
  const photo = document.querySelector<HTMLImageElement>("[data-photo-fold] img")!;
  Object.defineProperties(photo, { naturalWidth: { value: 1500 }, naturalHeight: { value: 2000 } });
  photo.setPointerCapture = vi.fn();
  photo.hasPointerCapture = () => false;
  photo.releasePointerCapture = vi.fn();
  const disc = (role: ColorRole) => document.querySelector<HTMLElement>(`[data-pin="${role}"]`)!;
  const point = (element: HTMLElement) => ({ x: parseFloat(element.style.left), y: parseFloat(element.style.top) });
  const assertLayout = () => {
    const discs = [...document.querySelectorAll<HTMLElement>("[data-pin]")];
    expect(discs).toHaveLength(5);
    for (const [i, rendered] of discs.entries()) {
      const p = point(rendered);
      const hit = document.querySelector<HTMLElement>(`[data-pin-hit="${rendered.dataset.pin}"]`)!;
      expect(point(hit)).toEqual(p);
      for (const other of discs.slice(i + 1)) {
        const q = point(other);
        const css = (v: number) => Math.floor(v * 64) / 64;
        expect(Math.hypot(css(p.x) - css(q.x), css(p.y) - css(q.y))).toBeGreaterThanOrEqual(PIN_MIN_SPACING_PX);
      }
    }
  };
  const pointer = async (type: string, p: { x: number; y: number }, input: "mouse" | "touch") => {
    // linkedom has no hit testing. Resolve the actual rendered, rounded hit
    // targets in reverse paint order instead of dispatching to a chosen role.
    const hits = [...document.querySelectorAll<HTMLElement>("[data-pin-hit]")];
    const underPointer = hits.filter(hit => {
      const center = point(hit);
      return Math.hypot(center.x - p.x, center.y - p.y) <= parseFloat(hit.style.width) / 2;
    });
    if (type === "pointerdown") expect(underPointer).toHaveLength(1);
    const target = type === "pointerdown" ? underPointer.at(-1)! : photo;
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clientX: p.x, clientY: p.y, pointerId: 1, isPrimary: true, button: 0, pointerType: input });
    await act(async () => { target.dispatchEvent(event); });
    assertLayout();
    return target;
  };
  const saved = () => {
    const fd = mocks.save.mock.calls.at(-1)![0] as FormData;
    return { pins: JSON.parse(fd.get("pins") as string), roles: JSON.parse(fd.get("roles") as string),
      origins: JSON.parse(fd.get("origins") as string) };
  };
  return { document, photo, disc, point, assertLayout, pointer, saved, cleanup };
}

describe.each([[390, 844], [375, 667]])("6208 pins at %sx%s", (width, height) => {
  it.each([null, "primary"] as const)("separates secondary/text anchors on the result and editor (open=%s)", async (openRole) => {
    const ui = await mount(width, height, openRole);
    try {
      ui.assertLayout();
      expect(ui.document.querySelector('[role="dialog"]') !== null).toBe(openRole !== null);
      const secondary = ui.disc("secondary");
      expect(secondary.dataset.pinDisplaced).toBeUndefined();
      const text = ui.disc("text");
      expect(text.dataset.pinDisplaced).toBe(width === 375 ? "true" : undefined);
      expect(text.dataset.pinOffcrop).toBeUndefined();
      expect(text.dataset.pinX).toBe(String(PIN_6208_COLORS.at(-1)!.pinX));
      expect(text.dataset.pinY).toBe(String(PIN_6208_COLORS.at(-1)!.pinY));
      if (width === 375) {
        const tick = ui.document.querySelector('[data-pin-tick="text"]')!;
        expect(tick.getAttribute("stroke-width")).toBe("1");
        expect(Number(tick.getAttribute("x1"))).toBe(ui.point(text).x);
        expect(Number(tick.getAttribute("y1"))).toBe(ui.point(text).y);
        expect(Number(tick.getAttribute("x2"))).toBeCloseTo(PIN_6208_COLORS.at(-1)!.pinX * width);
      }
    } finally { await ui.cleanup(); }
  });

  it("keeps a last-dropped secondary at its true point ahead of primary, with matching loupe and hit order", async () => {
    const ui = await mount(width, height, "primary");
    try {
      const primary = ui.point(ui.disc("primary"));
      const drop = { x: primary.x - 30, y: primary.y };
      await ui.pointer("pointerdown", ui.point(ui.disc("secondary")), "mouse");
      await ui.pointer("pointermove", drop, "mouse");
      expect(ui.point(ui.disc("secondary")).x).toBeCloseTo(drop.x, 8);
      expect(ui.point(ui.disc("secondary")).y).toBeCloseTo(drop.y, 8);
      await ui.pointer("pointerup", drop, "mouse");
      expect(ui.point(ui.disc("secondary")).x).toBeCloseTo(drop.x, 8);
      expect(ui.point(ui.disc("secondary")).y).toBeCloseTo(drop.y, 8);
      expect(ui.disc("secondary").getAttribute("data-pin-displaced")).toBeNull();
      expect(ui.disc("primary").getAttribute("data-pin-displaced")).toBe("true");
      expect(ui.saved().pins.primary).toEqual({ pinX: PIN_6208_COLORS[0]!.pinX, pinY: PIN_6208_COLORS[0]!.pinY });
      expect([...ui.document.querySelectorAll<HTMLElement>("[data-pin-hit]")].at(-1)!.getAttribute("data-pin-hit")).toBe("secondary");
      expect(ui.point(ui.document.querySelector<HTMLElement>("[data-qa-pointer]")!)).toEqual(ui.point(ui.disc("secondary")));
      const beforeNoop = ui.saved();
      const displaced = ui.point(ui.disc("primary"));
      expect((await ui.pointer("pointerdown", displaced, "mouse")).getAttribute("data-pin-hit")).toBe("primary");
      await ui.pointer("pointermove", { x: 200, y: 100 }, "mouse");
      await ui.pointer("pointerup", displaced, "mouse");
      expect(mocks.save).toHaveBeenCalledTimes(1);
      expect(ui.saved()).toEqual(beforeNoop);
      expect(ui.point(ui.disc("primary"))).toEqual(displaced);
    } finally { await ui.cleanup(); }
  });

  it.each(["mouse", "touch"] as const)("keeps grabbing primary after drop 4 beside secondary, including displaced no-ops (%s)", async (input) => {
    const ui = await mount(width, height, "primary");
    try {
      ui.assertLayout();
      const cropPosition = ui.photo.style.objectPosition;
      const fourth = { x: 164 * width / 390, y: 236 * width / 390 };
      await ui.pointer("pointerdown", ui.point(ui.disc("primary")), input);
      await ui.pointer("pointermove", fourth, input);
      await ui.pointer("pointerup", fourth, input);
      expect(ui.point(ui.disc("primary")).x).toBeCloseTo(fourth.x, 8);
      expect(ui.point(ui.disc("primary")).y).toBeCloseTo(fourth.y, 8);
      expect(ui.disc("secondary").getAttribute("data-pin-displaced")).toBe("true");
      expect(ui.disc("secondary").getAttribute("data-pin-offcrop")).toBeNull();
      const secondaryBefore = ui.saved().pins.secondary;
      expect(secondaryBefore).toEqual({ pinX: PIN_6208_COLORS[1]!.pinX, pinY: PIN_6208_COLORS[1]!.pinY });
      expect([...ui.document.querySelectorAll<HTMLElement>("[data-pin-hit]")].at(-1)!.dataset.pinHit).toBe("primary");
      // A lower-priority anchor displaced by spacing is a no-op at its disc.
      const afterFourth = ui.saved();
      const displaced = ui.point(ui.disc("secondary"));
      await ui.pointer("pointerdown", displaced, input);
      await ui.pointer("pointermove", { x: width / 2, y: photoFoldHeight(height) / 2 }, input);
      await ui.pointer("pointerup", displaced, input);
      expect(mocks.save).toHaveBeenCalledTimes(1);
      expect(ui.saved()).toEqual(afterFourth);
      expect(ui.point(ui.disc("secondary"))).toEqual(displaced);
      const hit = await ui.pointer("pointerdown", ui.point(ui.disc("primary")), input);
      expect(hit.getAttribute("data-pin-hit")).toBe("primary");
      expect(ui.document.querySelector("h2")!.textContent).toBe("Edit primary");
      const fifth = { x: 2, y: Math.round(photoFoldHeight(height) * 0.55) };
      await ui.pointer("pointermove", fifth, input);
      await ui.pointer("pointerup", fifth, input);
      expect(ui.saved()).toMatchObject({ pins: { primary: { pinX: 2 / width }, secondary: secondaryBefore },
        roles: { primary: "#3b4c60", secondary: "#95a1ab" }, origins: { primary: "sampled" } });
      expect(ui.disc("primary").getAttribute("data-pin-displaced")).toBe("true");
      expect(ui.disc("primary").getAttribute("data-pin-offcrop")).toBeNull();
      const beforeNoop = ui.saved();
      const sixth = ui.point(ui.disc("primary"));
      await ui.pointer("pointerdown", sixth, input);
      await ui.pointer("pointermove", { x: width / 2, y: sixth.y }, input);
      await ui.pointer("pointerup", sixth, input);
      expect(mocks.save).toHaveBeenCalledTimes(2);
      expect(ui.saved()).toEqual(beforeNoop);
      expect(ui.point(ui.disc("primary"))).toEqual(sixth);
      const seventh = { x: Math.round(width * 0.55), y: fifth.y };
      expect((await ui.pointer("pointerdown", sixth, input)).getAttribute("data-pin-hit")).toBe("primary");
      await ui.pointer("pointermove", seventh, input);
      await ui.pointer("pointerup", seventh, input);
      expect(mocks.save).toHaveBeenCalledTimes(3);
      expect(ui.saved().pins.primary.pinX).toBeCloseTo(seventh.x / width, 8);
      expect(ui.saved().pins.secondary).toEqual(secondaryBefore);
      expect(ui.photo.style.objectPosition).toBe(cropPosition);
      await act(async () => ui.document.querySelector('[data-role="primary"]')!.dispatchEvent(new ui.document.defaultView!.Event("focusin", { bubbles: true })));
      const lines = [...ui.document.querySelectorAll("[data-pin-line]")];
      COLOR_ROLES.filter(role => PIN_6208_COLORS.some(c => c.role === role)).forEach((role, i) => {
        expect(Number(lines[i]!.getAttribute("x1"))).toBe(ui.point(ui.disc(role)).x);
        expect(Number(lines[i]!.getAttribute("y1"))).toBe(ui.point(ui.disc(role)).y);
      });
    } finally { await ui.cleanup(); }
  });
});
