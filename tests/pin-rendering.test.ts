import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { KitResult } from "@/app/components/KitResult";
import type { TokenEditor } from "@/app/components/TokenEditor";
import { coverWindowForPins, mapCoverPin, PIN_DISC_RADIUS_PX } from "@/lib/cover-pin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
const editor = vi.hoisted(() => ({ props: null as ComponentProps<typeof TokenEditor> | null }));
vi.mock("@/app/components/TokenEditor", () => ({
  TokenEditor: (props: ComponentProps<typeof TokenEditor>) => { editor.props = props; return null; },
}));

function photo(pinX: number, pinY: number, openRole: "primary" | null) {
  const colors: ComponentProps<typeof KitResult>["colors"] = [
    { role: "primary", hex: "#3f5e92", pinX, pinY, position: 0, origin: "sampled" },
  ];
  const { document } = parseHTML(renderToStaticMarkup(createElement(KitResult, {
    itemId: "true-point", title: "Photo", imageSrc: "/photo.jpg", tileSrc: null,
    width: 390, height: 390, colors, preview: { reveal: "landed", openRole },
  })));
  return {
    disc: document.querySelector<HTMLElement>('[data-pin="primary"]')!,
    hit: document.querySelector<HTMLElement>('[data-pin-hit="primary"]')!,
    back: document.querySelector<HTMLElement>("[data-photo-back]")!,
    tick: document.querySelector<SVGElement>("[data-pin-tick]")!,
  };
}

describe.each([null, "primary"] as const)("true pin drawing (open role: %s)", (openRole) => {
  it("displaces an edge disc and its hit area while keeping the sampled coordinates", () => {
    const pinX = 0.5;
    const pinY = 2 / 390;
    const { disc, hit, tick } = photo(pinX, pinY, openRole);
    const crop = coverWindowForPins(390, 390, 390, 337, [{ x: pinX, y: pinY }])!;
    const mapped = mapCoverPin(pinX, pinY, 390, 390, 390, 337, crop)!;
    expect(parseFloat(disc.style.left)).toBeCloseTo(mapped.left * 390);
    expect(parseFloat(disc.style.top)).toBe(11 + PIN_DISC_RADIUS_PX);
    expect(hit.style.left).toBe(disc.style.left);
    expect(hit.style.top).toBe(disc.style.top);
    expect(disc.dataset.pinDisplaced).toBe("true");
    expect(Number(tick.getAttribute("x1"))).toBe(parseFloat(disc.style.left));
    expect(Number(tick.getAttribute("y1"))).toBe(parseFloat(disc.style.top));
    expect(Number(tick.getAttribute("x2"))).toBeCloseTo(mapped.left * 390);
    expect(Number(tick.getAttribute("y2"))).toBeCloseTo(2);
    expect(tick.getAttribute("stroke-width")).toBe("1");
    expect(disc.classList.contains("pointer-events-none")).toBe(true);
    expect(hit.classList.contains("pointer-events-auto")).toBe(true);
    expect(disc.dataset.pinX).toBe(String(pinX));
    expect(disc.dataset.pinY).toBe(String(pinY));
    expect(disc.dataset.origin).toBe("sampled");
  });

  it("displaces the disc under Back and centers its hit area on it", () => {
    const { disc, hit, back, tick } = photo(30 / 390, 30 / 390, openRole);
    expect(parseFloat(disc.style.left)).toBeCloseTo(30);
    expect(parseFloat(disc.style.top)).toBeCloseTo(56 + PIN_DISC_RADIUS_PX);
    expect(hit.style.left).toBe(disc.style.left);
    expect(hit.style.top).toBe(disc.style.top);
    expect(disc.dataset.pinDisplaced).toBe("true");
    expect(Number(tick.getAttribute("x2"))).toBeCloseTo(30);
    expect(Number(tick.getAttribute("y2"))).toBeCloseTo(30);
    expect(back.style.pointerEvents).toBe("auto");
    expect(back.classList.contains("z-[21]")).toBe(true);
    expect(back.style.left).toBe("12px");
    expect(back.style.top).toBe("calc(env(safe-area-inset-top, 0px) + 8px)");
  });

  it("leaves a non-zone disc and hit area at the true point without a tick", () => {
    const { disc, hit, tick } = photo(100 / 390, 100 / 390, openRole);
    expect(parseFloat(disc.style.left)).toBeCloseTo(100);
    expect(parseFloat(disc.style.top)).toBeCloseTo(100);
    expect(hit.style.left).toBe(disc.style.left);
    expect(hit.style.top).toBe(disc.style.top);
    expect(disc.hasAttribute("data-pin-displaced")).toBe(false);
    expect(tick).toBeNull();
  });
});

it("freezes the editing crop and keeps an off-crop pin visible before and after closing", async () => {
  const { window, document } = parseHTML("<html><body><div id='root'></div></body></html>");
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  vi.stubGlobal("window", window);
  vi.stubGlobal("self", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("getComputedStyle", () => ({ paddingTop: "0px" }));
  vi.stubGlobal("Image", class { decode() { return Promise.resolve(); } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  // linkedom has no layout engine; use the actual result photo's CSS dimensions.
  const originalWidth = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, "clientWidth");
  const originalHeight = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, "clientHeight");
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 390 });
  Object.defineProperty(window.HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 337 });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () => root.render(createElement(KitResult, {
      itemId: "frozen-crop", title: "Photo", imageSrc: "/photo.jpg", tileSrc: null,
      width: 390, height: 1000,
      colors: [{ role: "primary", hex: "#3f5e92", pinX: 0.5, pinY: 0.6, position: 0, origin: "sampled" }],
      preview: { reveal: "landed", openRole: "primary" },
    })));
    const image = document.querySelector<HTMLImageElement>("[data-photo-fold] img")!;
    const frozenPosition = image.style.objectPosition;
    const frozenCrop = editor.props!.crop;
    expect(document.querySelector('[data-pin="primary"]')).not.toBeNull();
    await act(async () => editor.props!.onPinDrag!({ role: "primary", x: 3, y: 2 }));
    const draggingDisc = document.querySelector<HTMLElement>('[data-pin="primary"]')!;
    expect(parseFloat(draggingDisc.style.left)).toBe(3);
    expect(parseFloat(draggingDisc.style.top)).toBe(2);
    expect(draggingDisc.dataset.pinY).toBe("0.6");
    expect(document.querySelector("[data-pin-tick]")).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-pin-hit="primary"]')!.style.top).toBe(draggingDisc.style.top);
    await act(async () => editor.props!.onPinDrag!(null));
    await act(async () => editor.props!.onColorsChange!([
      { role: "primary", position: 0, hex: "#abcdef", origin: "sampled", pinX: 0.5, pinY: 0.005 },
    ]));
    expect(editor.props!.crop).toEqual(frozenCrop);
    expect(image.style.objectPosition).toBe(frozenPosition);
    const offcropDisc = document.querySelector<HTMLElement>('[data-pin="primary"]')!;
    expect(offcropDisc.getAttribute("data-pin-displaced")).toBe("true");
    expect(offcropDisc.getAttribute("data-pin-offcrop")).toBe("true");
    expect(offcropDisc.dataset.pinY).toBe("0.005");
    expect(parseFloat(offcropDisc.style.top)).toBe(11 + PIN_DISC_RADIUS_PX);
    expect(document.querySelector<HTMLElement>('[data-pin-hit="primary"]')!.style.top).toBe(offcropDisc.style.top);
    expect(Number(document.querySelector('[data-pin-tick="primary"]')!.getAttribute("y2"))).toBeCloseTo(0);
    await act(async () => editor.props!.onOpenChange!(null));
    expect(image.style.objectPosition).not.toBe(frozenPosition);
    const disc = document.querySelector<HTMLElement>('[data-pin="primary"]')!;
    expect(parseFloat(disc.style.top)).toBe(11 + PIN_DISC_RADIUS_PX);
    expect(disc.getAttribute("data-pin-displaced")).toBe("true");
    expect(disc.hasAttribute("data-pin-offcrop")).toBe(false);
    expect(disc.dataset.pinY).toBe("0.005");
  } finally {
    await act(async () => root.unmount());
    if (originalWidth) Object.defineProperty(window.HTMLElement.prototype, "clientWidth", originalWidth);
    else Reflect.deleteProperty(window.HTMLElement.prototype, "clientWidth");
    if (originalHeight) Object.defineProperty(window.HTMLElement.prototype, "clientHeight", originalHeight);
    else Reflect.deleteProperty(window.HTMLElement.prototype, "clientHeight");
    vi.unstubAllGlobals();
  }
});
