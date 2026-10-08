import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { KitResult } from "@/app/components/KitResult";
import type { TokenEditor } from "@/app/components/TokenEditor";
import { coverWindowForPins, mapCoverPin, PIN_HIT_SIZE_PX } from "@/lib/cover-pin";

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
  };
}

describe.each([null, "primary"] as const)("true pin drawing (open role: %s)", (openRole) => {
  it("draws the disc over the sampled source pixel while clamping only its hit area", () => {
    const pinX = 0.5;
    const pinY = 2 / 390;
    const { disc, hit } = photo(pinX, pinY, openRole);
    const crop = coverWindowForPins(390, 390, 390, 337, [{ x: pinX, y: pinY }])!;
    const mapped = mapCoverPin(pinX, pinY, 390, 390, 390, 337, crop)!;
    expect(parseFloat(disc.style.left)).toBeCloseTo(mapped.left * 390);
    expect(parseFloat(disc.style.top)).toBeCloseTo(mapped.top * 337);
    expect(parseFloat(disc.style.top)).toBeCloseTo(2);
    expect(parseFloat(hit.style.top)).toBe(16);
    expect(disc.classList.contains("pointer-events-none")).toBe(true);
    expect(hit.classList.contains("pointer-events-auto")).toBe(true);
    expect(disc.dataset.pinX).toBe(String(pinX));
    expect(disc.dataset.pinY).toBe(String(pinY));
    expect(disc.dataset.origin).toBe("sampled");
  });

  it("moves the hit area of a pin under Back without displacing its disc", () => {
    const { disc, hit, back } = photo(30 / 390, 30 / 390, openRole);
    expect(parseFloat(disc.style.left)).toBeCloseTo(30);
    expect(parseFloat(disc.style.top)).toBeCloseTo(30);
    const x = parseFloat(hit.style.left);
    const y = parseFloat(hit.style.top);
    const radius = PIN_HIT_SIZE_PX / 2;
    expect(x - radius >= 56 || y - radius >= 52).toBe(true);
    expect(back.style.pointerEvents).toBe("auto");
    expect(back.classList.contains("z-[21]")).toBe(true);
  });
});

it("freezes the editing crop, hides a pin moved outside it, and reveals its true point on close", async () => {
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
    await act(async () => editor.props!.onPromoteRole!("primary", { pinX: 0.5, pinY: 0.005, hex: "#abcdef" }));
    expect(editor.props!.crop).toEqual(frozenCrop);
    expect(image.style.objectPosition).toBe(frozenPosition);
    expect(document.querySelector('[data-pin="primary"]')).toBeNull();
    expect(document.querySelector('[data-pin-hit="primary"]')).toBeNull();
    await act(async () => editor.props!.onOpenChange!(null));
    expect(image.style.objectPosition).not.toBe(frozenPosition);
    const disc = document.querySelector<HTMLElement>('[data-pin="primary"]')!;
    expect(parseFloat(disc.style.top)).toBeCloseTo(5);
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
