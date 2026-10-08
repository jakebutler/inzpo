import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import type { Root } from "react-dom/client";
import { COLOR_ROLES } from "@/lib/db/schema";
import { emptyKit, HANDOFF_KITS } from "@/lib/mascot";
import { BAKU_ART_POSES, bakuV6BandMaskSrc } from "@/lib/baku-v6";
import { BAKU_UNDYED_KNIT, shadeRoleColor, tintRoles, tintSpriteWithBands } from "@/lib/baku-tint";

vi.mock("gsap", () => ({ gsap: { registerPlugin: vi.fn(), fromTo: vi.fn() } }));
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
  it("renders every pose as a plain colour image when disabled with 0", async () => {
    const { React, root, document } = await renderEnvironment("0");
    const imageLoader = vi.fn();
    vi.stubGlobal("Image", imageLoader);
    const createElement = vi.spyOn(document, "createElement");
    const flags = await import("@/lib/baku-v6");
    const tint = await import("@/lib/baku-tint");
    const tintSpy = vi.spyOn(tint, "tintSpriteWithBands");
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
          expect(document.querySelector("[data-baku-shadow]")).toBeNull();
          expect(document.querySelectorAll("[data-baku-body]")).toHaveLength(1);
          expect(body?.getAttribute("style")).toContain("scaleX(-1)");
          expect(body?.getAttribute("style")).not.toMatch(/clip-path|brightness|opacity/);
          expect(document.querySelector("[data-baku-shadow-baked]")?.getAttribute("data-baku-shadow-baked")).toBe("1");
        }
      }
      await React.act(async () => root.render(React.createElement(Mascot, {
        pose: "idle", size: 72, assetSize: 72, faceText: true,
      })));
      expect(document.querySelector("[data-baku-body]")?.getAttribute("src")).toBe("/baku/v6/baku-idle-lg-color@1x.png");
      expect(imageLoader).not.toHaveBeenCalled();
      expect(createElement.mock.calls.some(([tag]) => tag === "canvas")).toBe(false);
      expect(tintSpy).not.toHaveBeenCalled();
      expect(loadMascotRive).not.toHaveBeenCalled();
    } finally {
      await unmount(root, React.act);
    }
  });

  it.each(([48, 72] as const).flatMap(assetSize => ([1, 2, 3] as const).flatMap(density =>
    ["bands", "shade", "color"].map(failedAsset => ({ assetSize, density, failedAsset })))))(
    "$assetSize px @$density x: falls back to the matching colour sprite when $failedAsset fails", async ({ assetSize, density, failedAsset }) => {
    const { React, root, document } = await renderEnvironment();
    Object.defineProperty(window, "devicePixelRatio", { value: density, configurable: true });
    const requests: string[] = [];
    vi.stubGlobal("Image", class {
      naturalWidth = 48;
      naturalHeight = 48;
      onload?: () => void;
      onerror?: () => void;
      set src(src: string) {
        requests.push(src);
        queueMicrotask(() => src.includes(`-${failedAsset}`) ? this.onerror?.() : this.onload?.());
      }
    });
    const flags = await import("@/lib/baku-v6");
    const tint = await import("@/lib/baku-tint");
    const tintSpy = vi.spyOn(tint, "tintSpriteWithBands");
    const { BakuSprite } = await import("@/app/components/BakuSprite");
    expect(flags.BAKU_TINT_ENABLED).toBe(true);
    expect(flags.bakuCanTint("idle")).toBe(true);
    expect(flags.bakuCanTint("empty")).toBe(false);
    for (const pose of ["404", "chewing", "error-brief", "idle", "success"] as const) {
      expect(flags.bakuCanTint(pose)).toBe(true);
    }
    expect(flags.bakuCanTint("error-photo")).toBe(false);
    expect(flags.bakuCanTint("error-unreadable")).toBe(false);
    try {
      await React.act(async () => root.render(React.createElement(BakuSprite, {
        pose: "idle", kit: HANDOFF_KITS.IMG_6208, size: assetSize, assetSize, faceText: true, fallback: null,
      })));
      const prefix = `/baku/v6/baku-idle${assetSize === 72 ? "-lg" : ""}`;
      expect(requests).toContain(`${prefix}-shade@${density}x.png`);
      expect(requests).toContain(`${prefix}-bands@${density}x.png`);
      expect(requests).toContain(`${prefix}-color@${density}x.png`);
      const body = document.querySelector("[data-baku-body]");
      expect(body?.getAttribute("src")).toBe(`${prefix}-color@${density}x.png`);
      expect(body?.getAttribute("width")).toBe(String(assetSize));
      expect(body?.getAttribute("style")).toContain("scaleX(-1)");
      expect(document.querySelector("[data-baku-tinted]")?.getAttribute("data-baku-tinted")).toBe("0");
      expect(tintSpy).not.toHaveBeenCalled();
    } finally {
      await unmount(root, React.act);
    }
  });

  it.each([undefined, "1", "", "false"])("enables tint unless the flag is exactly 0 (%s)", async (flag) => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_BAKU_TINT", flag);
    expect((await import("@/lib/baku-v6")).BAKU_TINT_ENABLED).toBe(true);
  });

  it("renders empty SVG stripes oatmeal on the first frame and at every reveal count", async () => {
    const { React, root, document } = await renderEnvironment();
    vi.stubGlobal("Image", class { set src(_src: string) {} });
    const { Mascot } = await import("@/app/components/Mascot");
    try {
      for (const kit of [emptyKit(), HANDOFF_KITS.IMG_6208]) {
        for (const revealedCount of [0, 1, 2, 3, 4, 5, 6, null]) {
          await React.act(async () => root.render(React.createElement(Mascot, {
            pose: "idle", kit, revealedCount,
          })));
          expect(document.querySelector("[data-baku-sprite]")?.getAttribute("data-baku-sprite")).toBe("svg");
          COLOR_ROLES.forEach((role, i) => {
            const stripe = document.querySelector(`.baku-stripe-${role}`);
            if (!kit[role]) {
              expect(stripe?.getAttribute("fill")).toBe("#E4D9C6");
              expect(stripe?.getAttribute("style")).toBe("fill:#E4D9C6");
              expect(stripe?.getAttribute("data-baku-empty")).toBe("true");
            } else if (revealedCount == null || i < revealedCount) {
              expect(stripe?.getAttribute("fill")).toBe(kit[role]);
            } else {
              expect(stripe).toBeNull();
            }
          });
          expect(document.querySelector("pattern")).toBeNull();
          expect(document.querySelector("animate")).toBeNull();
        }
      }
    } finally {
      await unmount(root, React.act);
    }
  });

  it.each([1, 2, 3] as const)("uses only the large set for every brief state at DPR %s, with oatmeal on the first frame", async (density) => {
    const { React, root, document } = await renderEnvironment();
    Object.defineProperty(window, "devicePixelRatio", { value: density, configurable: true });
    const requests: string[] = [];
    vi.stubGlobal("Image", class { set src(src: string) { requests.push(src); } });
    const { BriefSlot } = await import("@/app/components/BriefSlot");
    const { useGSAP } = await import("@gsap/react");
    const { gsap } = await import("gsap");
    const note = "Warm brick in late afternoon shade.";
    try {
      for (const state of [
        { status: "ready", pose: "idle" }, { status: "pending", pose: "chewing" },
        { status: "failed", pose: "error-brief" }, { status: "ready", hidden: true, pose: "idle" },
        { status: "ready", saved: true, pose: "success" },
      ] as const) {
        await React.act(async () => root.render(React.createElement(BriefSlot, {
          ...state, kit: HANDOFF_KITS.IMG_6208, note, stripeReveal: 0,
        })));
        const slot = document.querySelector("[data-baku-slot]");
        expect(slot?.getAttribute("style")).toContain("width:72px;height:72px");
        expect(slot?.parentElement?.className).toContain("items-center");
        expect(document.querySelector("svg")?.getAttribute("width")).toBe("72");
        const animate = vi.mocked(useGSAP).mock.calls.at(-1)?.[0] as (() => void) | undefined;
        animate?.();
        expect(gsap.fromTo).not.toHaveBeenCalled();
        for (const role of ["accent", "surface"]) {
          expect(document.querySelector(`.baku-stripe-${role}`)?.getAttribute("fill")).toBe(BAKU_UNDYED_KNIT);
        }
        for (const asset of ["color", "bands", "shade"]) {
          expect(requests).toContain(`/baku/v6/baku-${state.pose}-lg-${asset}@${density}x.png`);
        }
      }
      expect(requests.every(src => src.includes("-lg-"))).toBe(true);
      expect(document.querySelector("[data-brief-text]")?.textContent).toBe(note);
      expect(document.querySelector("[data-saved-caption]")?.textContent).toContain("Saved");
    } finally {
      await unmount(root, React.act);
    }
  });

  it("passes oatmeal for empty kit colours if a Rive runtime is available", async () => {
    const { React, root } = await renderEnvironment();
    vi.stubGlobal("Image", class { set src(_src: string) {} });
    const { loadMascotRive } = await import("@/app/components/load-mascot-rive");
    const render = vi.fn(() => React.createElement("div"));
    vi.mocked(loadMascotRive).mockResolvedValue({ render });
    const { Mascot } = await import("@/app/components/Mascot");
    try {
      for (const kit of [emptyKit(), HANDOFF_KITS.IMG_6208]) {
        await React.act(async () => root.render(React.createElement(Mascot, {
          pose: "idle", kit, snapReady: true, revealedCount: 0,
        })));
        expect(render).toHaveBeenLastCalledWith({
          pose: "idle", size: 48,
          kit: Object.fromEntries(COLOR_ROLES.map(role => [role, kit[role] ?? BAKU_UNDYED_KNIT])),
        });
      }
    } finally {
      await unmount(root, React.act);
      vi.mocked(loadMascotRive).mockReset();
    }
  });
});
