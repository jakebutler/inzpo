import { describe, expect, it } from "vitest";
import { coverWindowForPins, mapCoverPinRaw, pointerOnCoverBox } from "@/lib/cover-pin";
import { isNoopPinDrag, isNoopPinSample, resolvePinDropPoint } from "@/lib/pin-drag";

describe("resolvePinDropPoint", () => {
  const last = { clientX: 360, clientY: 179 };
  it("prefers the real release position for mouse, pen and touch", () => {
    expect(resolvePinDropPoint({ type: "pointerup", clientX: 374, clientY: 183 }, last))
      .toEqual({ clientX: 374, clientY: 183 });
  });
  it.each([[0, 0], [NaN, 179], [360, NaN], [Infinity, 179]])(
    "falls back to the last real position for unusable up (%s, %s)", (clientX, clientY) => {
      expect(resolvePinDropPoint({ type: "pointerup", clientX, clientY }, last)).toEqual(last);
    },
  );
  it.each([[0, 0], [360, 179], [NaN, NaN]])("reverts cancel (%s, %s)", (clientX, clientY) => {
    expect(resolvePinDropPoint({ type: "pointercancel", clientX, clientY }, last)).toBeNull();
  });
  it("does not interpret lost capture as a release", () => {
    expect(resolvePinDropPoint({ type: "lostpointercapture", ...last }, last)).toBeNull();
  });
  it("allows real edge coordinates, including a move to the viewport origin", () => {
    expect(resolvePinDropPoint({ type: "pointerup", clientX: 0, clientY: 179 }, last))
      .toEqual({ clientX: 0, clientY: 179 });
    const origin = { clientX: 0, clientY: 0 };
    expect(resolvePinDropPoint({ type: "pointerup", ...origin }, origin)).toEqual(origin);
  });
  it("cannot fall back to a missing or invalid last position", () => {
    const up = { type: "pointerup", clientX: NaN, clientY: NaN };
    expect(resolvePinDropPoint(up, null)).toBeNull();
    expect(resolvePinDropPoint(up, { clientX: NaN, clientY: 20 })).toBeNull();
  });
});

describe("pin drop mapping and no-op decisions", () => {
  const image = { width: 2000, height: 1000 };
  const box = { left: 21, top: 73, width: 390, height: 337 };
  const crop = coverWindowForPins(image.width, image.height, box.width, box.height, [{ x: 0.62, y: 0.4 }])!;
  const geometry = { ...image, boxWidth: box.width, boxHeight: box.height, crop };

  it("maps an offset screen position through the panned cover crop to source pixels and back", () => {
    const release = { x: 320, y: 180 };
    const point = pointerOnCoverBox(box.left + release.x, box.top + release.y, box, crop)!;
    expect(point.nx * image.width).toBeCloseTo((crop.vx + release.x / box.width * crop.vw) * image.width);
    expect(point.ny * image.height).toBeCloseTo(release.y / box.height * image.height);
    const pixelX = Math.round(point.nx * image.width);
    const pixelY = Math.round(point.ny * image.height);
    const drawn = mapCoverPinRaw(pixelX / image.width, pixelY / image.height,
      image.width, image.height, box.width, box.height, crop)!;
    expect(Math.abs(drawn.left * box.width - release.x)).toBeLessThanOrEqual(0.5 * box.width / (crop.vw * image.width));
    expect(Math.abs(drawn.top * box.height - release.y)).toBeLessThanOrEqual(0.5 * box.height / (crop.vh * image.height));
  });

  it("ignores an out-and-back drop even if the original pin disc was clamped away from its source point", () => {
    const start = pointerOnCoverBox(box.left + 16, box.top + 80, box, crop)!;
    // The role's existing source pin can be outside the visible crop.
    expect(isNoopPinSample({ pinX: 0, pinY: 0 }, start, geometry)).toBe(false);
    expect(isNoopPinDrag(start, { ...start }, image)).toBe(true);
  });

  it("preserves an existing pin even when the press started elsewhere", () => {
    const pin = { pinX: 0.62, pinY: 0.4 };
    const position = mapCoverPinRaw(pin.pinX, pin.pinY, image.width, image.height, box.width, box.height, crop)!;
    const end = pointerOnCoverBox(box.left + position.left * box.width,
      box.top + position.top * box.height, box, crop)!;
    expect(isNoopPinSample(pin, end, geometry)).toBe(true);
  });

  it("treats jitter within 4 CSS px as a no-op and anything farther as a move", () => {
    const start = { x: 0, y: 0, nx: 0, ny: 0 };
    expect(isNoopPinDrag(start, { x: 4, y: 0, nx: 0.004, ny: 0 }, image)).toBe(true);
    expect(isNoopPinDrag(start, { x: 3, y: 2.6, nx: 0.003, ny: 0.003 }, image)).toBe(true);
    expect(isNoopPinDrag(start, { x: 4.1, y: 0, nx: 0.0041, ny: 0 }, image)).toBe(false);
    expect(isNoopPinDrag(start, { x: 1, y: 0, nx: NaN, ny: 0 }, image)).toBe(false);
    expect(isNoopPinDrag(start, start, { width: 0, height: 1000 })).toBe(false);
  });

  it("rejects bad geometry and positions outside the visible photo", () => {
    expect(pointerOnCoverBox(NaN, 100, box, crop)).toBeNull();
    expect(pointerOnCoverBox(100, 100, { ...box, left: NaN }, crop)).toBeNull();
    expect(pointerOnCoverBox(100, 100, box, { ...crop, vw: NaN })).toBeNull();
    expect(pointerOnCoverBox(box.left - 1, box.top + 80, box, crop)).toBeNull();
  });
});
