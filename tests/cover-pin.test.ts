import { describe, expect, it } from "vitest";
import { clampPinCenter, coverWindow, coverWindowForPins, mapCoverPin, pointerOnCoverBox, PIN_CROP_MARGIN_PX, PIN_HIT_SIZE_PX } from "@/lib/cover-pin";

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

  it("nudges an out-of-crop sample into view at its true point, even inside the edge inset", () => {
    const pin = { x: 0.5, y: 0.005 };
    expect(mapCoverPin(pin.x, pin.y, 1500, 2000, 390, 337)).toBeNull();
    const win = coverWindowForPins(1500, 2000, 390, 337, [pin])!;
    const drawn = mapCoverPin(pin.x, pin.y, 1500, 2000, 390, 337, win)!;
    expect(drawn.top * 337).toBeCloseTo(2.6);
    expect(clampPinCenter(drawn.left * 390, drawn.top * 337, 390, 337).y).toBe(16);
    const source = pointerOnCoverBox(drawn.left * 390, drawn.top * 337,
      { left: 0, top: 0, width: 390, height: 337 }, win)!;
    expect(source.ny).toBeCloseTo(pin.y);
  });

  it("does not map an out-of-crop pin to a false edge point in a frozen crop", () => {
    const frozen = coverWindowForPins(1500, 2000, 390, 337, [{ x: 0.5, y: 0.8 }])!;
    expect(mapCoverPin(0.5, 0.005, 1500, 2000, 390, 337, frozen)).toBeNull();
  });
});

describe("pin hit areas", () => {
  it("clamps only the hit center at each photo edge", () => {
    for (const [x, y, expected] of [
      [1, 2, { x: 16, y: 16 }],
      [389, 336, { x: 374, y: 321 }],
    ] as const) {
      const sample = { x, y };
      expect(clampPinCenter(x, y, 390, 337)).toEqual(expected);
      expect(sample).toEqual({ x, y });
    }
  });

  it.each([0, 47])("moves the whole hit area clear of Back with a %spx safe area", (safeTop) => {
    const back = { left: 12, top: safeTop + 8, right: 56, bottom: safeTop + 52 };
    const disc = { x: 30, y: safeTop + 30 };
    const hit = clampPinCenter(disc.x, disc.y, 390, 337, safeTop, PIN_HIT_SIZE_PX / 2, back);
    const radius = PIN_HIT_SIZE_PX / 2;
    expect(hit).not.toEqual(disc);
    expect(hit.x - radius >= back.right || hit.y - radius >= back.bottom ||
      hit.x + radius <= back.left || hit.y + radius <= back.top).toBe(true);
    expect(hit.x - radius).toBeGreaterThanOrEqual(0);
    expect(hit.y - radius).toBeGreaterThanOrEqual(safeTop);
    expect(hit.x + radius).toBeLessThanOrEqual(390);
    expect(hit.y + radius).toBeLessThanOrEqual(337);
    expect(disc).toEqual({ x: 30, y: safeTop + 30 });
  });

  it("leaves a hit area beside Back in place", () => {
    expect(clampPinCenter(100, 30, 390, 337, 0, 16,
      { left: 12, top: 8, right: 56, bottom: 52 })).toEqual({ x: 100, y: 30 });
  });
});
