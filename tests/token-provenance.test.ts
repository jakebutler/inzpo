import { describe, expect, it, vi } from "vitest";
import { emptyRoles } from "@/lib/tokens";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwnerId: async () => "test-owner" }));
vi.mock("@/lib/item-tokens", () => ({ replaceItemTokens: mocks.replace }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveItemTokensAction } from "@/app/actions/tokens";

describe("saving real role provenance", () => {
  it("preserves contrast fix provenance and leaves the fallback unpinned", async () => {
    const roles = { ...emptyRoles(), background: "#79acd3", text: "#1c1b19" };
    const data = new FormData();
    data.set("itemId", "test-kit");
    data.set("roles", JSON.stringify(roles));
    data.set("pins", JSON.stringify({ background: { pinX: 0.2, pinY: 0.3 } }));
    data.set("origins", JSON.stringify({ background: "region", text: "fix" }));
    await saveItemTokensAction(data);
    expect(mocks.replace).toHaveBeenLastCalledWith("test-owner", "test-kit", roles,
      { background: { pinX: 0.2, pinY: 0.3 } }, { background: "region", text: "fix" });
  });

  it("preserves region and user-set origins, and keeps empty roles null", async () => {
    const roles = { ...emptyRoles(), background: "#123456", text: "#abcdef" };
    const pins = { background: { pinX: 0.2, pinY: 0.3 }, text: { pinX: 0.8, pinY: 0.4 } };
    const data = new FormData();
    data.set("itemId", "test-kit");
    data.set("roles", JSON.stringify(roles));
    data.set("pins", JSON.stringify(pins));
    data.set("origins", JSON.stringify({ background: "region", text: "sampled", accent: "region" }));
    await saveItemTokensAction(data);
    expect(mocks.replace).toHaveBeenCalledWith("test-owner", "test-kit", roles, pins, { background: "region", text: "sampled" });
  });
});
