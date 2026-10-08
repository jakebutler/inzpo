import { describe, expect, it } from "vitest";
import { clampPinCenter, coverWindow, coverWindowForPins, mapCoverPin, pointerOnCoverBox, PIN_CROP_MARGIN_PX, PIN_EDGE_MARGIN_PX, PIN_DISC_RADIUS_PX, photoBackZone, pinPlacement } from "@/lib/cover-pin";

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
    expect(clampPinCenter(drawn.left * 390, drawn.top * 337, 390, 337).y).toBe(11 + PIN_DISC_RADIUS_PX);
    const source = pointerOnCoverBox(drawn.left * 390, drawn.top * 337,
      { left: 0, top: 0, width: 390, height: 337 }, win)!;
    expect(source.ny).toBeCloseTo(pin.y);
  });

  it("does not map an out-of-crop pin to a false edge point in a frozen crop", () => {
    const frozen = coverWindowForPins(1500, 2000, 390, 337, [{ x: 0.5, y: 0.8 }])!;
    expect(mapCoverPin(0.5, 0.005, 1500, 2000, 390, 337, frozen)).toBeNull();
  });
});

describe("pin safe zones", () => {
  const radius = PIN_DISC_RADIUS_PX;
  const inset = PIN_EDGE_MARGIN_PX + radius;

  it.each([0, 47])("centers the 52px Back zone on the actual button with %spx safe top", (safeTop) => {
    expect(photoBackZone(safeTop)).toEqual({ left: 8, top: safeTop + 4, right: 60, bottom: safeTop + 56 });
  });

  it.each([[1, 100, inset, 100], [389, 100, 390 - inset, 100],
    [100, 2, 100, inset], [100, 336, 100, 337 - inset], [1, 2, inset, inset]])(
    "fits the whole disc inside the 11px inset for edge sample (%s, %s)", (x, y, dx, dy) => {
      const placement = pinPlacement(x, y, 390, 337);
      expect(placement.disc).toEqual({ x: dx, y: dy });
      expect(placement.hit).toEqual(placement.disc);
      expect(placement.displaced).toBe(true);
      expect(placement.tick).toEqual({ x1: dx, y1: dy, x2: x, y2: y });
      expect(dx - radius).toBeGreaterThanOrEqual(11);
      expect(dy - radius).toBeGreaterThanOrEqual(11);
      expect(dx + radius).toBeLessThanOrEqual(390 - 11);
      expect(dy + radius).toBeLessThanOrEqual(337 - 11);
    },
  );

  it.each([0, 47])("chooses the nearest legal side of Back at safe top %s", (safeTop) => {
    const zone = photoBackZone(safeTop);
    for (const [x, y, disc] of [
      [50, safeTop + 30, { x: zone.right + radius, y: safeTop + 30 }],
      [30, safeTop + 50, { x: 30, y: zone.bottom + radius }],
      [2, safeTop + 30, { x: inset, y: safeTop ? zone.top - radius : zone.bottom + radius }],
    ] as const) {
      const placement = pinPlacement(x, y, 390, 337, zone);
      expect(placement.disc).toEqual(disc);
      expect(disc.x - radius >= zone.right || disc.y - radius >= zone.bottom ||
        disc.x + radius <= zone.left || disc.y + radius <= zone.top).toBe(true);
      expect(placement.tick).toEqual({ x1: disc.x, y1: disc.y, x2: x, y2: y });
      expect(placement.hit).toEqual(disc);
    }
  });

  it("can use the space above Back when the safe-area top makes it available", () => {
    expect(pinPlacement(30, 55, 390, 337, photoBackZone(47)).disc).toEqual({ x: 30, y: 51 - radius });
  });

  it.each([[100, 30], [11, 100], [379, 326], [61, 30]])("keeps non-zone point (%s, %s) unchanged without a tick", (x, y) => {
    expect(pinPlacement(x, y, 390, 337, photoBackZone())).toEqual({
      disc: { x, y }, hit: { x, y }, displaced: false, tick: null,
    });
  });
});
