import { describe, expect, it } from "vitest";
import { COLOR_ROLES, emptyRoles, filledRoles, rolesFromColors } from "@inzpo/shared";
import { COLOR_ROLES as WEB_COLOR_ROLES } from "@/lib/db/schema";
import { rolesFromColors as webRolesFromColors } from "@/lib/tokens";

describe("shared roles", () => {
  it("keeps the schema's role order", () => {
    expect(COLOR_ROLES).toEqual(WEB_COLOR_ROLES);
  });

  it("leaves every missing role null, including when there are unassigned colors", () => {
    const roles = rolesFromColors([{ hex: "#ABCDEF", role: "accent" }, { hex: "#111111", role: null }]);
    expect(roles).toEqual({ ...emptyRoles(), accent: "#abcdef" });
    expect(filledRoles(roles)).toEqual(["accent"]);
    expect(rolesFromColors([])).toEqual(emptyRoles());
    expect(rolesFromColors([{ hex: "#111111" }])).toEqual(emptyRoles());
  });

  it("keeps the first assigned color and normalizes like the web", () => {
    const colors = [
      { hex: " ABC ", role: "primary" as const },
      { hex: "#123456", role: "primary" as const },
      { hex: "#ABCDEF", role: "text" as const },
    ];
    expect(rolesFromColors(colors)).toEqual(webRolesFromColors(colors));
    expect(rolesFromColors(colors)).toEqual({ ...emptyRoles(), primary: "#aabbcc", text: "#abcdef" });
    expect(filledRoles(rolesFromColors(colors))).toEqual(["primary", "text"]);
  });

  it("rejects invalid first colors without falling through to another color", () => {
    const colors = [
      { hex: "garbage", role: "primary" as const },
      { hex: "#123456", role: "primary" as const },
      { hex: "#12345678", role: "secondary" as const },
    ];
    expect(rolesFromColors(colors)).toEqual(emptyRoles());
    expect(rolesFromColors(colors)).toEqual(webRolesFromColors(colors));
  });

  it("returns independent empty role records", () => {
    const first = emptyRoles();
    first.primary = "#111111";
    expect(emptyRoles().primary).toBeNull();
  });
});
