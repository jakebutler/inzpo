import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import type { Root } from "react-dom/client";
import { COLOR_ROLES } from "@/lib/db/schema";
import { HANDOFF_KITS } from "@/lib/mascot";
import { BAKU_ART_POSES, bakuV6BandMaskSrc } from "@/lib/baku-v6";
import { BAKU_UNDYED_KNIT, shadeRoleColor, tintRoles, tintSpriteWithBands } from "@/lib/baku-tint";

vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));
vi.mock("@/app/components/load-mascot-rive", () => ({ loadMascotRive: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Designer Baku shade formula", () => {
  it("preserves neutral colours, halves them at 64, and clamps highlights", () => {
    expect(shadeRoleColor("#806040", 128)).toEqual([128, 96, 64]);
    expect(shadeRoleColor("#806040", 64)).toEqual([64, 48, 32]);
    expect(shadeRoleColor("#E4D9C6", 255)).toEqual([255, 255, 255]);
  });

  it("keeps empty roles oatmeal from the first frame without revealing them", () => {
    const kit = HANDOFF_KITS.IMG_6208;
    for (const count of [0, 2, 4, 6, null]) {
      const colors = tintRoles(kit, count);
      expect(colors[2]).toBe(BAKU_UNDYED_KNIT);
      expect(colors[4]).toBe("#E4D9C6");
      const pixel = new Uint8ClampedArray([100, 100, 100, 255]);
      tintSpriteWithBands(pixel, new Uint8ClampedArray([120]), 1, 1, 4, 1, colors, new Uint8ClampedArray([128]), 1);
      expect([...pixel]).toEqual([228, 217, 198, 255]);
    }
    expect(tintRoles(kit, 0)[0]).toBeNull();
    expect(tintRoles(kit, 6)[0]).toBe(kit.primary);
  });

  it("keeps role order and leaves pixels outside masks unchanged", () => {
    const colors = tintRoles(HANDOFF_KITS.IMG_6505, null);
    expect(colors).toEqual(COLOR_ROLES.map(role => HANDOFF_KITS.IMG_6505[role]));
    COLOR_ROLES.forEach((role, i) => {
      expect(bakuV6BandMaskSrc("idle", role)).toBe(`/baku/v6/baku-idle-band${i + 1}@1x.png`);
    });
    const original = [100, 110, 120, 200];
    const sprite = new Uint8ClampedArray([...original, ...original, ...original]);
    const bands = new Uint8ClampedArray([40, 40, 40, 255, 0, 0, 0, 255, 40, 40, 40, 0]);
    tintSpriteWithBands(sprite, bands, 3, 1, 4, 4, ["#806040"], new Uint8ClampedArray([64, 128, 128]), 1);
    expect([...sprite]).toEqual([64, 48, 32, 200, ...original, ...original]);
  });
});

async function renderEnvironment(flag?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BAKU_TINT", flag);
  const { window, document } = parseHTML("<html><body><div id='root'></div></body></html>");
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", { userAgent: "vitest" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const React = await import("react");
  vi.stubGlobal("React", React);
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root") as unknown as HTMLElement);
  return { React, root, document };
}

async function unmount(root: Root, act: typeof import("react").act) {
  await act(async () => root.unmount());
}

describe("Baku rendering flag", () => {
  it("renders every pose as a plain colour image by default, with no tint, masks, canvas, or Rive", async () => {
    const { React, root, document } = await renderEnvironment();
    const imageLoader = vi.fn();
    vi.stubGlobal("Image", imageLoader);
    const createElement = vi.spyOn(document, "createElement");
    const flags = await import("@/lib/baku-v6");
    const tint = await import("@/lib/baku-tint");
    const tintSpy = vi.spyOn(tint, "tintSpriteWithBands");
    const rolesSpy = vi.spyOn(tint, "tintRoles");
    const { Mascot } = await import("@/app/components/Mascot");
    const { loadMascotRive } = await import("@/app/components/load-mascot-rive");
    expect(flags.BAKU_TINT_ENABLED).toBe(false);
    try {
      for (const pose of [...BAKU_ART_POSES, "error-unreadable"] as const) {
        for (const forcePoseAsset of [false, true]) {
          await React.act(async () => root.render(React.createElement(Mascot, {
            pose, kit: HANDOFF_KITS.IMG_6208, size: 96, snapReady: true,
            forcePoseAsset, revealedCount: 0, ground: "#384b5f", faceText: true,
          })));
          expect(flags.bakuCanTint(pose)).toBe(false);
          const body = document.querySelector("[data-baku-body]");
          expect(body?.getAttribute("src")).toBe(flags.bakuV6ColorSrc(pose, 2));
          expect(body?.getAttribute("width")).toBe("96");
          expect(document.querySelector("[data-baku-tinted]")?.getAttribute("data-baku-tinted")).toBe("0");
          const shadow = document.querySelector("[data-baku-shadow]");
          expect(shadow?.getAttribute("src")).toBe(flags.bakuV6ColorSrc(pose, 2));
          expect(shadow?.getAttribute("style")).toContain("brightness(0)");
          expect(shadow?.getAttribute("style")).toContain("opacity:0.18");
        }
      }
      expect(imageLoader).not.toHaveBeenCalled();
      expect(createElement.mock.calls.some(([tag]) => tag === "canvas")).toBe(false);
      expect(tintSpy).not.toHaveBeenCalled();
      expect(rolesSpy).not.toHaveBeenCalled();
      expect(loadMascotRive).not.toHaveBeenCalled();
    } finally {
      await unmount(root, React.act);
    }
  });

  it("opts in with 1 and falls back to the colour sprite when the shade asset is missing", async () => {
    const { React, root, document } = await renderEnvironment("1");
    const requests: string[] = [];
    vi.stubGlobal("Image", class {
      naturalWidth = 48;
      naturalHeight = 48;
      onload?: () => void;
      onerror?: () => void;
      set src(src: string) {
        requests.push(src);
        queueMicrotask(() => src.includes("-shade") ? this.onerror?.() : this.onload?.());
      }
    });
    const flags = await import("@/lib/baku-v6");
    const tint = await import("@/lib/baku-tint");
    const tintSpy = vi.spyOn(tint, "tintSpriteWithBands");
    const { BakuSprite } = await import("@/app/components/BakuSprite");
    expect(flags.BAKU_TINT_ENABLED).toBe(true);
    expect(flags.bakuCanTint("idle")).toBe(true);
    expect(flags.bakuCanTint("empty")).toBe(false);
    try {
      await React.act(async () => root.render(React.createElement(BakuSprite, {
        pose: "idle", kit: HANDOFF_KITS.IMG_6208, size: 48, fallback: null,
      })));
      expect(requests).toContain("/baku/v6/baku-idle-shade@1x.png");
      expect(requests).toContain("/baku/v6/baku-idle-bands@1x.png");
      expect(document.querySelector("[data-baku-body]")?.getAttribute("src")).toBe("/baku/v6/baku-idle-color@1x.png");
      expect(document.querySelector("[data-baku-tinted]")?.getAttribute("data-baku-tinted")).toBe("0");
      expect(tintSpy).not.toHaveBeenCalled();
    } finally {
      await unmount(root, React.act);
    }
  });
});
