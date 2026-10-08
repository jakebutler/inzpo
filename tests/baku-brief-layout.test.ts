import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { BriefSlot, type BriefSlotStatus } from "@/app/components/BriefSlot";
import { ContrastAa } from "@/app/components/ContrastAa";
import { HANDOFF_KITS, MASCOT_SIZE_BRIEF_PX } from "@/lib/mascot";
import { SAVE_BAR_PAD } from "@/lib/layout";

const states = ([390, 375] as const).flatMap(width => [
  { status: "pending" as BriefSlotStatus }, { status: "failed" as BriefSlotStatus },
  { status: "ready" as BriefSlotStatus }, { status: "ready" as BriefSlotStatus, saved: true },
  { status: "ready" as BriefSlotStatus, hidden: true },
].map(state => ({ width, ...state })));

describe("72px brief layout constraints", () => {
  it.each(states)("$width px, $status, saved=$saved, hidden=$hidden: contains Baku and keeps copy before Aa with save clearance", ({ width, ...state }) => {
    const kit = HANDOFF_KITS.IMG_6208;
    const note = "Blue shade and a dropped gold, gathered from the walk home along the warm stone walls.";
    const html = renderToStaticMarkup(createElement("div", { style: { width, paddingBottom: SAVE_BAR_PAD } },
      createElement(BriefSlot, { ...state, kit, note }), createElement(ContrastAa, { roles: kit })));
    const { document } = parseHTML(html);
    const brief = document.querySelector<HTMLElement>("[data-brief-slot]")!;
    const slot = brief.querySelector<HTMLElement>("[data-baku-slot]")!;
    const row = slot.parentElement!;
    const copy = slot.nextElementSibling;
    expect(slot.style.width).toBe("72px");
    expect(slot.style.height).toBe("72px");
    expect(slot.style.flex).toBe("0 0 auto");
    expect(row.className).toBe("flex items-center gap-3");
    expect(brief.className).toBe("px-5 py-4");
    // Automatic height contains the 72px sprite plus 32px padding and any wrapped text.
    // No fixed height or position can move it into the following Aa row.
    expect(brief.style.height).toBeFalsy();
    expect(brief.style.position).toBeFalsy();
    expect(brief.nextElementSibling?.hasAttribute("data-contrast-line")).toBe(true);
    expect(brief.parentElement?.style.paddingBottom).toBe(SAVE_BAR_PAD);
    // Tailwind px-5 (40px total) and gap-3 (12px) leave 266/251px for normal wrapping.
    const availableTextWidth = width - 40 - MASCOT_SIZE_BRIEF_PX - 12;
    expect(availableTextWidth).toBe(width === 390 ? 266 : 251);
    if (state.hidden) {
      expect(copy).toBeNull();
    } else {
      expect(copy?.className).toBe("min-w-0 flex-1");
      expect(copy?.querySelector("[data-saved-caption]") != null).toBe(state.saved === true);
      if (state.saved) expect(copy?.querySelector("[data-brief-text]")?.textContent).toBe(note);
      const skeleton = copy?.querySelector("[data-brief-skeleton]");
      if (skeleton) expect(availableTextWidth).toBeGreaterThanOrEqual(128); // w-32 fits.
    }
  });
});
