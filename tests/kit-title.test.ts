import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generatedKitTitle, kitAltText, kitDisplayName } from "@/lib/kit-name";

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

function existingTitle(title: string | null) {
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ title }] }) }) });
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
    expect(generatedKitTitle({ briefText: ready.text, namedColors: ready.namedColors })).toBe("Soft Yellow");
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
});
