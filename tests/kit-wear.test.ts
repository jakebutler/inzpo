import { describe, expect, it } from "vitest";
import { INK, PAPER } from "@/lib/brand";
import { contrastRatio, gatedTextColor } from "@/lib/contrast";
import { kitWearStyle } from "@/lib/kit-wear";
import { emptyRoles } from "@/lib/tokens";

describe("kit page and save bar text", () => {
  it.each([
    { background: "#426297", text: INK, expected: PAPER },
    { background: PAPER, text: PAPER, expected: INK },
    { background: "#426297", text: "#ffffff", expected: "#ffffff" },
  ])("uses $expected on $background, matching the brief", ({ background, text, expected }) => {
    const style = kitWearStyle({ ...emptyRoles(), background, text });
    expect(style.color).toBe(expected);
    expect(style).toHaveProperty("--foreground", expected);
    expect(style.color).toBe(gatedTextColor(text, background));
    expect(contrastRatio(expected, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("gives paper text approximately 5.3:1 contrast on the blue kit", () => {
    expect(contrastRatio(INK, "#426297")).toBeLessThan(4.5);
    expect(contrastRatio(PAPER, "#426297")).toBeCloseTo(5.3, 1);
  });
});
