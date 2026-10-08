import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { KitResult } from "@/app/components/KitResult";
import { photoFoldHeight } from "@/lib/brand";
import { photoBackZone, PIN_DISC_RADIUS_PX, PIN_EDGE_MARGIN_PX, PIN_MIN_SPACING_PX } from "@/lib/cover-pin";
import * as coverPins from "@/lib/cover-pin";
import { COLOR_ROLES } from "@/lib/db/schema";
import { PIN_6505_COLORS as colors } from "./fixtures/pins";

const mocks = vi.hoisted(() => ({ save: vi.fn(), pixel: vi.fn(), average: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/app/actions/tokens", () => ({ saveItemTokensAction: mocks.save }));
vi.mock("@/lib/client-eyedropper", () => ({ sampleImagePixel: mocks.pixel, sampleImageAverage: mocks.average }));
// Keep the real TokenEditor, bands and pointer handlers; omit only portal/focus plumbing.
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? children : null,
  SheetContent: ({ children }: { children: ReactNode }) => createElement("div", { role: "dialog" }, children),
  SheetHeader: ({ children }: { children: ReactNode }) => children,
  SheetTitle: ({ children }: { children: ReactNode }) => children,
}));

describe.each([[390, 844], [375, 667]])("6505 pins at %sx%s", (width, height) => {
  it.each([
    { openRole: null, topCrop: false }, { openRole: "accent", topCrop: false },
    { openRole: null, topCrop: true }, { openRole: "accent", topCrop: true },
    { openRole: "background", topCrop: true },
  ] as const)("renders five discs and preserves same-spot drops (open=$openRole, top crop=$topCrop)", async ({ openRole, topCrop }) => {
    vi.clearAllMocks();
    const { window, document } = parseHTML("<html><body><div id='root'></div></body></html>");
    const photoH = photoFoldHeight(height);
    // Also exercise a frozen top-aligned cover crop: true sky point behind Back,
    // cream trim below the photo. The default crop puts both samples off-crop.
    const cropSpy = topCrop ? vi.spyOn(coverPins, "coverWindowForPins").mockReturnValue({
      vx: 0, vy: 0, vw: 1, vh: photoH / (width / 0.75),
    }) : null;
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
    mocks.average.mockReturnValue({ hex: "#abcdef" });
    mocks.pixel.mockImplementation((_img, nx, ny) => ({ hex: "#abcdef", pinX: nx, pinY: ny }));
    const proto = window.HTMLElement.prototype;
    const originalWidth = Object.getOwnPropertyDescriptor(proto, "clientWidth");
    const originalHeight = Object.getOwnPropertyDescriptor(proto, "clientHeight");
    const originalRect = proto.getBoundingClientRect;
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => width });
    Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => photoH });
    proto.getBoundingClientRect = function () {
      const role = this.getAttribute("data-role");
      const top = role ? photoH + COLOR_ROLES.indexOf(role as typeof COLOR_ROLES[number]) * 40
        : this.hasAttribute("data-band-stack") ? photoH : 0;
      const h = role ? 40 : this.hasAttribute("data-band-stack") ? 240 : photoH;
      return { x: 0, y: top, left: 0, top, right: width, bottom: top + h, width, height: h } as DOMRect;
    };
    const root = createRoot(document.getElementById("root")!);
    try {
      await act(async () => root.render(createElement(KitResult, {
        itemId: "6505", title: "Yellow Victorian", imageSrc: "/photo.jpg", tileSrc: null,
        width: 1500, height: 2000, colors: topCrop ? [...colors].reverse() : colors,
        preview: { reveal: "landed", openRole, loupe: openRole === "background" },
      })));
      const photo = document.querySelector<HTMLImageElement>("[data-photo-fold] img")!;
      Object.defineProperties(photo, { naturalWidth: { value: 1500 }, naturalHeight: { value: 2000 } });
      photo.setPointerCapture = vi.fn();
      photo.hasPointerCapture = () => false;
      photo.releasePointerCapture = vi.fn();
      const frozenPosition = photo.style.objectPosition;
      const discs = () => [...document.querySelectorAll<HTMLElement>("[data-pin]")];
      expect([...document.querySelectorAll<HTMLElement>("[data-role]")].filter(band => band.dataset.hex)).toHaveLength(5);
      expect(discs()).toHaveLength(5);
      expect(new Set(discs().map(disc => disc.dataset.pin)).size).toBe(5);
      expect(document.querySelector('[role="dialog"]') !== null).toBe(openRole !== null);
      for (const [i, disc] of discs().entries()) {
        const x = parseFloat(disc.style.left);
        const y = parseFloat(disc.style.top);
        for (const other of discs().slice(i + 1)) {
          expect(Math.hypot(x - parseFloat(other.style.left), y - parseFloat(other.style.top)))
            .toBeGreaterThanOrEqual(PIN_MIN_SPACING_PX);
        }
        expect(parseFloat(disc.style.width)).toBeGreaterThan(0);
        expect(parseFloat(disc.style.height)).toBeGreaterThan(0);
        const margin = disc.hasAttribute("data-pin-displaced") ? PIN_EDGE_MARGIN_PX : 0;
        expect(x - PIN_DISC_RADIUS_PX).toBeGreaterThanOrEqual(margin);
        expect(y - PIN_DISC_RADIUS_PX).toBeGreaterThanOrEqual(margin);
        expect(x + PIN_DISC_RADIUS_PX).toBeLessThanOrEqual(width - margin);
        expect(y + PIN_DISC_RADIUS_PX).toBeLessThanOrEqual(photoH - margin);
        const saved = colors.find(c => c.role === disc.dataset.pin)!;
        expect(disc.dataset.pinX).toBe(String(saved.pinX));
        expect(disc.dataset.pinY).toBe(String(saved.pinY));
      }
      if (topCrop) {
        const primary = document.querySelector<HTMLElement>('[data-pin="primary"]')!;
        expect(parseFloat(primary.style.left)).toBeCloseTo(colors[0]!.pinX * width);
        expect(parseFloat(primary.style.top)).toBeCloseTo(colors[0]!.pinY * width / 0.75);
        expect(primary.hasAttribute("data-pin-displaced")).toBe(false);
      }
      if (openRole === "background") {
        const disc = document.querySelector<HTMLElement>('[data-pin="background"]')!;
        const loupePointer = document.querySelector<HTMLElement>("[data-qa-pointer]")!;
        expect(loupePointer.style.left).toBe(disc.style.left);
        expect(loupePointer.style.top).toBe(disc.style.top);
      }
      const zone = photoBackZone();
      for (const role of ["accent", "background"]) {
        const disc = document.querySelector<HTMLElement>(`[data-pin="${role}"]`)!;
        expect(disc.dataset.pinDisplaced).toBe("true");
        expect(disc.hasAttribute("data-pin-offcrop")).toBe(role === "background" || !topCrop);
        const x = parseFloat(disc.style.left);
        const y = parseFloat(disc.style.top);
        expect(x - PIN_DISC_RADIUS_PX >= zone.right || y - PIN_DISC_RADIUS_PX >= zone.bottom ||
          x + PIN_DISC_RADIUS_PX <= zone.left || y + PIN_DISC_RADIUS_PX <= zone.top).toBe(true);
        const hit = document.querySelector<HTMLElement>(`[data-pin-hit="${role}"]`)!;
        expect(hit.style.left).toBe(disc.style.left);
        expect(hit.style.top).toBe(disc.style.top);
        const tick = document.querySelector(`[data-pin-tick="${role}"]`)!;
        expect(Number(tick.getAttribute("x1"))).toBe(x);
        expect(Number(tick.getAttribute("y1"))).toBe(y);
        expect(tick.getAttribute("stroke-width")).toBe("1");
        const saved = colors.find(c => c.role === role)!;
        const pointer = async (type: string, clientX: number, clientY: number, target: Element = photo) => {
          const event = new window.Event(type, { bubbles: true, cancelable: true });
          Object.assign(event, { clientX, clientY, pointerId: 1, isPrimary: true, button: 0 });
          await act(async () => { target.dispatchEvent(event); });
        };
        // Real out-and-back drag from the visible disc, far from its saved source point.
        const others = () => discs().filter(d => d.dataset.pin !== role).map(d => [d.dataset.pin, d.style.left, d.style.top]);
        const settledOthers = others();
        await pointer("pointerdown", x, y, hit);
        await pointer("pointermove", width / 2, photoH / 2);
        // Lower-priority anchors move when the dragged disc crosses them.
        for (const [i, rendered] of discs().entries()) {
          for (const other of discs().slice(i + 1)) {
            expect(Math.hypot(parseFloat(rendered.style.left) - parseFloat(other.style.left),
              parseFloat(rendered.style.top) - parseFloat(other.style.top))).toBeGreaterThanOrEqual(PIN_MIN_SPACING_PX);
          }
        }
        expect(parseFloat(disc.style.left)).toBe(width / 2);
        expect(parseFloat(disc.style.top)).toBe(photoH / 2);
        expect(hit.style.left).toBe(disc.style.left);
        expect(hit.style.top).toBe(disc.style.top);
        await pointer("pointerup", x, y);
        expect(others()).toEqual(settledOthers);
        expect(mocks.save).not.toHaveBeenCalled();
        expect(mocks.pixel).not.toHaveBeenCalled();
        expect(document.querySelector<HTMLInputElement>("#token-hex")!.value).toBe(saved.hex);
        expect(disc.getAttribute("data-pin-x")).toBe(String(saved.pinX));
        expect(disc.getAttribute("data-pin-y")).toBe(String(saved.pinY));
        expect(parseFloat(disc.style.left)).toBe(x);
        expect(parseFloat(disc.style.top)).toBe(y);
        expect(disc.getAttribute("data-pin-displaced")).toBe("true");
        expect(disc.hasAttribute("data-pin-offcrop")).toBe(role === "background" || !topCrop);
        expect(discs()).toHaveLength(5);
        expect(photo.style.objectPosition).toBe(frozenPosition);
      }
      // Exercise the rendered leaders through the real band's focus callback.
      await act(async () => document.querySelector('[data-role="background"]')!.dispatchEvent(new window.Event("focusin", { bubbles: true })));
      const lines = [...document.querySelectorAll("[data-pin-line]")];
      expect(lines).toHaveLength(5);
      COLOR_ROLES.filter(role => colors.some(c => c.role === role)).forEach((role, i) => {
        const disc = document.querySelector<HTMLElement>(`[data-pin="${role}"]`)!;
        expect(Number(lines[i]!.getAttribute("x1"))).toBe(parseFloat(disc.style.left));
        expect(Number(lines[i]!.getAttribute("y1"))).toBe(parseFloat(disc.style.top));
      });
    } finally {
      await act(async () => root.unmount());
      if (originalWidth) Object.defineProperty(proto, "clientWidth", originalWidth);
      else Reflect.deleteProperty(proto, "clientWidth");
      if (originalHeight) Object.defineProperty(proto, "clientHeight", originalHeight);
      else Reflect.deleteProperty(proto, "clientHeight");
      proto.getBoundingClientRect = originalRect;
      cropSpy?.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
