import { describe, expect, it } from "vitest";
import { clampPinCenter, coverWindow, coverWindowForPins, coverPinPlacement, mapCoverPin, mapCoverPinRaw, pointerOnCoverBox, PIN_CROP_MARGIN_PX, PIN_EDGE_MARGIN_PX, PIN_DISC_RADIUS_PX, photoBackZone, pinPlacement } from "@/lib/cover-pin";

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
      disc: { x, y }, hit: { x, y }, displaced: false, offcrop: false, tick: null,
    });
  });
});

describe("visible cover pin placement", () => {
  const boxW = 390;
  const boxH = 337;
  const inset = PIN_EDGE_MARGIN_PX + PIN_DISC_RADIUS_PX;
  const crop = Object.freeze({ vx: 0.25, vy: 0.25, vw: 0.5, vh: 0.5 });

  it("keeps an in-crop pin at its true point", () => {
    expect(coverPinPlacement(0.5, 0.5, 1000, 1000, boxW, boxH, crop, photoBackZone())).toEqual({
      disc: { x: 195, y: 168.5 }, hit: { x: 195, y: 168.5 },
      displaced: false, offcrop: false, tick: null,
    });
  });

  it("moves a back-zone point without marking it off-crop and ticks back to the true point", () => {
    const placement = coverPinPlacement(30 / boxW, 30 / boxH, boxW, boxH, boxW, boxH,
      { vx: 0, vy: 0, vw: 1, vh: 1 }, photoBackZone())!;
    expect(placement.disc).toEqual({ x: 30, y: 56 + PIN_DISC_RADIUS_PX });
    expect(placement.displaced).toBe(true);
    expect(placement.offcrop).toBe(false);
    expect(placement.tick).toMatchObject({ x1: placement.disc.x, y1: placement.disc.y });
    expect(placement.tick!.x2).toBeCloseTo(30);
    expect(placement.tick!.y2).toBeCloseTo(30);
  });

  it.each([
    ["left", 0.2, 0.5, inset, boxH / 2],
    ["right", 0.8, 0.5, boxW - inset, boxH / 2],
    ["top", 0.5, 0.2, boxW / 2, inset],
    ["bottom", 0.5, 0.8, boxW / 2, boxH - inset],
    ["top-left", 0.2, 0.2, inset, inset],
    ["top-right", 0.8, 0.2, boxW - inset, inset],
    ["bottom-left", 0.2, 0.8, inset, boxH - inset],
    ["bottom-right", 0.8, 0.8, boxW - inset, boxH - inset],
  ] as const)("places an off-crop %s pin at the inset with an outward, photo-clipped tick", (_side, pinX, pinY, x, y) => {
    const placement = coverPinPlacement(pinX, pinY, 1000, 1000, boxW, boxH, crop)!;
    expect(placement.disc).toEqual({ x, y });
    expect(placement.hit).toEqual(placement.disc);
    expect(placement.displaced).toBe(true);
    expect(placement.offcrop).toBe(true);
    const tick = placement.tick!;
    expect(tick.x1).toBe(x);
    expect(tick.y1).toBe(y);
    expect(tick.x2).toBeGreaterThanOrEqual(-1e-9);
    expect(tick.x2).toBeLessThanOrEqual(boxW + 1e-9);
    expect(tick.y2).toBeGreaterThanOrEqual(-1e-9);
    expect(tick.y2).toBeLessThanOrEqual(boxH + 1e-9);
    expect(Math.min(Math.abs(tick.x2), Math.abs(tick.x2 - boxW), Math.abs(tick.y2), Math.abs(tick.y2 - boxH)))
      .toBeLessThan(1e-9);
    expect(Math.hypot(tick.x2 - x, tick.y2 - y) - PIN_DISC_RADIUS_PX).toBeGreaterThanOrEqual(8);
    const truePoint = mapCoverPinRaw(pinX, pinY, 1000, 1000, boxW, boxH, crop)!;
    const dx = truePoint.left * boxW - x;
    const dy = truePoint.top * boxH - y;
    // Collinear with, and pointing toward, the unmodified source sample.
    expect((tick.x2 - x) * dy - (tick.y2 - y) * dx).toBeCloseTo(0, 8);
    expect((tick.x2 - x) * dx + (tick.y2 - y) * dy).toBeGreaterThan(0);
  });

  it("clears Back when an off-crop corner clamps into its zone, preserving the saved point", () => {
    const saved = Object.freeze({ pinX: 0.2, pinY: 0.2, hex: "#426092" });
    const before = { ...saved };
    const placement = coverPinPlacement(saved.pinX, saved.pinY, 1000, 1000, boxW, boxH, crop, photoBackZone())!;
    const zone = photoBackZone();
    const { disc, tick } = placement;
    expect(disc.x - PIN_DISC_RADIUS_PX >= zone.right || disc.y - PIN_DISC_RADIUS_PX >= zone.bottom ||
      disc.x + PIN_DISC_RADIUS_PX <= zone.left || disc.y + PIN_DISC_RADIUS_PX <= zone.top).toBe(true);
    expect(placement.displaced).toBe(true);
    expect(placement.offcrop).toBe(true);
    expect(Math.hypot(tick!.x2 - disc.x, tick!.y2 - disc.y) - PIN_DISC_RADIUS_PX).toBeGreaterThanOrEqual(8);
    expect(saved).toEqual(before);
    expect(crop).toEqual({ vx: 0.25, vy: 0.25, vw: 0.5, vh: 0.5 });
  });
});
