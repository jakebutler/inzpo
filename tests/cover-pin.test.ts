import { describe, expect, it } from "vitest";
import { coverWindow, coverWindowForPins, mapCoverPin, pointerOnCoverBox, PIN_CROP_MARGIN_PX } from "@/lib/cover-pin";

describe("mapCoverPin", () => {
  it("maps source pixels onto an object-fit cover box", () => {
    const mapped = mapCoverPin(0.5, 0.5, 1500, 2000, 390, 380);
    expect(mapped).not.toBeNull();
    expect(mapped!.left).toBeGreaterThan(0);
    expect(mapped!.left).toBeLessThan(1);
    expect(mapped!.top).toBeGreaterThan(0);
    expect(mapped!.top).toBeLessThan(1);
  });

  it("returns null when the pin was cropped away", () => {
    expect(mapCoverPin(0.01, 0.5, 2000, 1000, 100, 100)).toBeNull();
  });

  it("keeps a centered pin centered on a matching aspect", () => {
    const mapped = mapCoverPin(0.5, 0.5, 100, 100, 100, 100);
    expect(mapped).toEqual({ left: 0.5, top: 0.5 });
  });

  it("maps a click on a 249px fold the same way as a 337px fold", () => {
    const win249 = coverWindowForPins(1500, 2000, 375, 249, [{ x: 0.5, y: 0.4 }]);
    const mapped = mapCoverPin(0.5, 0.4, 1500, 2000, 375, 249, win249);
    expect(mapped).not.toBeNull();
    const box = { left: 0, top: 0, width: 375, height: 249 };
    const win = coverWindow(1500, 2000, 375, 249)!;
    const pointer = pointerOnCoverBox(mapped!.left * 375, mapped!.top * 249, box, win249 ?? win);
    expect(pointer).not.toBeNull();
    expect(pointer!.nx).toBeCloseTo(0.5, 2);
  });

  it("pans the cover crop so sampled pins sit inside with a 16px margin", () => {
    expect(PIN_CROP_MARGIN_PX).toBe(16);
    const boxW = 390;
    const boxH = 337;
    const pins = [
      { x: 0.5, y: 0.05 },
      { x: 0.5, y: 0.18 },
    ];
    const win = coverWindowForPins(1500, 2000, boxW, boxH, pins);
    expect(win).not.toBeNull();
    for (const pin of pins) {
      const mapped = mapCoverPin(pin.x, pin.y, 1500, 2000, boxW, boxH, win);
      expect(mapped).not.toBeNull();
      expect(mapped!.left * boxW).toBeGreaterThanOrEqual(16);
      expect(mapped!.top * boxH).toBeGreaterThanOrEqual(16);
      expect(boxW - mapped!.left * boxW).toBeGreaterThanOrEqual(16);
      expect(boxH - mapped!.top * boxH).toBeGreaterThanOrEqual(16);
    }
  });
});
