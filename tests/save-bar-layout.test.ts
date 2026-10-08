import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeSaveBarHeight, SAVE_BAR_FADE_HEIGHT, SAVE_BAR_HEIGHT_VAR, SAVE_BAR_PAD } from "@/lib/layout";

afterEach(() => vi.unstubAllGlobals());

describe("fixed save bar clearance", () => {
  it("updates the local reserve when the saved bar grows, including safe-area padding", () => {
    const { document } = parseHTML('<main><div id="kit"><div id="bar"></div></div></main>');
    const scope = document.getElementById("kit")!;
    const bar = document.getElementById("bar")!;
    let height = 76;
    vi.spyOn(bar, "getBoundingClientRect").mockImplementation(() => ({ height }) as DOMRect);
    let resize = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });

    const cleanup = observeSaveBarHeight(bar);
    expect(observe).toHaveBeenCalledWith(bar);
    expect(scope.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR)).toBe("76px");
    // A taller saved variant, then a change in the safe-area inset.
    for (height of [156, 190]) {
      resize();
      expect(scope.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR)).toBe(`${height}px`);
    }
    expect(document.documentElement.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR)).toBeFalsy();
    cleanup();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(scope.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR)).toBeFalsy();
  });

  it("measures even without ResizeObserver and restores the previous scoped value", () => {
    const { document } = parseHTML('<div style="--save-bar-height: 100px"><div id="bar"></div></div>');
    const bar = document.getElementById("bar")!;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({ height: 124 } as DOMRect);
    vi.stubGlobal("ResizeObserver", undefined);
    const cleanup = observeSaveBarHeight(bar);
    expect(bar.parentElement!.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR)).toBe("124px");
    cleanup();
    expect(bar.parentElement!.style.getPropertyValue(SAVE_BAR_HEIGHT_VAR)).toBe("100px");
  });

  it("reserves the measured bar plus the same fade height and a gap, with a safe-area fallback", () => {
    expect(SAVE_BAR_PAD).toBe(`max(calc(8.5rem + env(safe-area-inset-bottom, 0px)), calc(var(${SAVE_BAR_HEIGHT_VAR}, 0px) + ${SAVE_BAR_FADE_HEIGHT} + 1rem))`);
    const bar = readFileSync("app/components/SaveBar.tsx", "utf8");
    expect(bar).toContain("observeSaveBarHeight(barRef.current)");
    expect(bar).toContain("height: SAVE_BAR_FADE_HEIGHT");
    expect(bar).toContain("fixed inset-x-0 bottom-0");
    const result = readFileSync("app/components/KitResult.tsx", "utf8");
    expect(result).toContain("paddingBottom: SAVE_BAR_PAD");
  });
});
