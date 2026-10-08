import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generatedKitTitle, kitAltText, kitDisplayName } from "@/lib/kit-name";
import { COLOR_ROLES, itemColors, items, type ColorRole } from "@/lib/db/schema";
import { LIVE_KIT_NAMES } from "./fixtures/kit-names";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  readBriefJob: vi.fn(),
  runBriefJob: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock("@/lib/brief", () => ({ readBriefJob: mocks.readBriefJob, runBriefJob: mocks.runBriefJob }));
vi.mock("@/lib/auth/owner", () => ({ requireOwnerId: async () => "owner", assertItemOwned: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { persistKitTitleFromBrief } from "@/lib/kit-title";
import { GET, POST } from "@/app/api/briefs/[id]/route";

const ready = {
  status: "ready",
  text: "Soft yellow.",
  namedColors: [{ hex: "#ffff00", label: "yellow" }],
  stub: false,
};

type SavedColor = { hex: string; role: ColorRole | null; origin: string; pinX?: number; pinY?: number };
function existingTitle(title: string | null, colors: SavedColor[] = [{ hex: "#ffff00", role: "primary", origin: "sampled" }]) {
  mocks.select.mockReturnValue({ from: (table: unknown) => ({ where: () =>
    table === items ? { limit: async () => [{ title }] } : Promise.resolve(colors),
  }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  existingTitle(null);
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: async () => {} });
  mocks.readBriefJob.mockResolvedValue(ready);
  mocks.runBriefJob.mockResolvedValue(ready);
});

describe("persistKitTitleFromBrief", () => {
  it.each(LIVE_KIT_NAMES)("persists $id using its actual role, not the named chip", async (fixture) => {
    existingTitle("IMG_1234", [
      { role: "background", hex: "#ffffff", origin: "sampled" },
      { role: "accent", hex: "#00ff00", origin: "sampled" },
      { role: "primary", hex: fixture.primaryHex, origin: "sampled" },
    ]);
    expect(await persistKitTitleFromBrief("kit", {
      ...ready, text: fixture.briefText, namedColors: fixture.namedColors,
    })).toBe(fixture.expected);
    expect(mocks.set).toHaveBeenCalledWith({ title: fixture.expected, updatedAt: expect.any(Date) });
    expect(mocks.select).toHaveBeenLastCalledWith({
      hex: itemColors.hex, role: itemColors.role, origin: itemColors.origin,
      pinX: itemColors.pinX, pinY: itemColors.pinY,
    });
  });

  it.each(COLOR_ROLES)("uses %s when earlier real roles are empty", async (role) => {
    const colors = COLOR_ROLES.slice(COLOR_ROLES.indexOf(role)).reverse().map((savedRole) => ({
      role: savedRole, hex: savedRole === role ? "#0000ff" : "#ff0000", origin: "sampled",
    }));
    existingTitle(null, colors);
    expect(await persistKitTitleFromBrief("kit", { ...ready, text: "A yellow facade." })).toBe("Facade Blue");
  });

  it("skips legacy derived padding and invalid or unassigned colours", async () => {
    existingTitle(null, [
      { role: null, hex: "#ff0000", origin: "sampled" },
      { role: "primary", hex: "#ff0000", origin: "extracted", pinX: 0.5, pinY: 0.5 },
      { role: "secondary", hex: "invalid", origin: "sampled" },
      { role: "accent", hex: "#0000ff", origin: "sampled" },
      { role: "background", hex: "#ffffff", origin: "sampled" },
    ]);
    expect(await persistKitTitleFromBrief("kit", { ...ready, text: "A mural." })).toBe("Mural Blue");
  });

  it("persists the model's subject", async () => {
    expect(await persistKitTitleFromBrief("kit", { ...ready, text: "A facade.", subject: "victorian house" })).toBe("Victorian House Yellow");
  });

  it("writes the corrected generated name once and preserves it on later briefs", async () => {
    expect(await persistKitTitleFromBrief("kit", ready)).toBe("Soft Yellow");
    expect(mocks.set).toHaveBeenCalledWith({ title: "Soft Yellow", updatedAt: expect.any(Date) });
    existingTitle("Soft Yellow");
    expect(await persistKitTitleFromBrief("kit", { ...ready, text: "Playful yellow." })).toBe("Soft Yellow");
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it.each(["Red Crimson", "Yellow Soft", "Yellow Butter", "Studio 54", "Main Street"])(
    "never renames existing kit %s", async (title) => {
      existingTitle(title);
      expect(await persistKitTitleFromBrief("kit", ready)).toBe(title);
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("does not generate names from pending, failed, or stub briefs", async () => {
    for (const job of [{ ...ready, status: "pending" }, { ...ready, status: "failed" }, { ...ready, stub: true }]) {
      expect(await persistKitTitleFromBrief("kit", job)).toBeNull();
    }
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("brief API persisted title", () => {
  it.each([GET, POST])("returns the existing title despite a conflicting generated name (%#)", async (handler) => {
    existingTitle("Red Crimson");
    expect(generatedKitTitle({ briefText: ready.text, namedColors: ready.namedColors, primaryHex: "#ffff00" })).toBe("Soft Yellow");
    const response = await handler(new NextRequest("http://localhost/api/briefs/kit"), { params: Promise.resolve({ id: "kit" }) });
    const body = await response.json();
    expect(body.title).toBe("Red Crimson");
    expect(kitDisplayName(body)).toBe("Red Crimson");
    expect(kitAltText(body)).toBe("Red Crimson");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns the newly persisted generated title", async () => {
    const response = await GET(new NextRequest("http://localhost/api/briefs/kit"), { params: Promise.resolve({ id: "kit" }) });
    expect((await response.json()).title).toBe("Soft Yellow");
    expect(mocks.set).toHaveBeenCalledWith({ title: "Soft Yellow", updatedAt: expect.any(Date) });
  });

  it.each([GET, POST])("returns the saved role title and model subject through the API (%#)", async (handler) => {
    const job = { ...ready, subject: "house", text: "Pale yellow facade." };
    mocks.readBriefJob.mockResolvedValue(job);
    existingTitle(null, [{ hex: "#3f5e92", role: "primary", origin: "sampled" }]);
    const response = await handler(new NextRequest("http://localhost/api/briefs/kit"), { params: Promise.resolve({ id: "kit" }) });
    expect(await response.json()).toMatchObject({ title: "House Blue", subject: "house" });
  });
});
