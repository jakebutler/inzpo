import { describe, expect, it } from "vitest";
import { briefMarkdown, KIT_EXPORT_FILES, tokensJsonFromRoles, textureSvg } from "@/lib/kit-export";
import { pinNumbers, rolesFromColors } from "@/lib/tokens";

describe("kit export files", () => {
  it("exports four files", () => {
    expect(KIT_EXPORT_FILES).toEqual(["tokens.json", "tokens.css", "brief.md", "texture.svg"]);
  });

  it("marks empty roles as fallback in tokens.json", () => {
    const roles = rolesFromColors([
      { hex: "#7fafd4", role: "primary" },
      { hex: "#a2afbd", role: "secondary" },
      { hex: "#384b5f", role: "background" },
      { hex: "#bec6cd", role: "text" },
    ]);
    const json = JSON.parse(tokensJsonFromRoles(roles)) as {
      color: Record<string, { $value: string; fallback?: boolean }>;
    };
    expect(json.color.primary.fallback).toBeUndefined();
    expect(json.color.accent.fallback).toBe(true);
    expect(json.color.surface.fallback).toBe(true);
    expect(json.color.accent.$value).toBe("#a2afbd");
    expect(json.color.surface.$value).toBe("#384b5f");
  });

  it("differentiates pending, failed, and none in brief.md", () => {
    expect(briefMarkdown(null, "pending")).toBe("# Brief\n\nThe brief is still running.\n");
    expect(briefMarkdown(null, "failed")).toBe("# Brief\n\nThe brief didn't finish. Re-run it from the kit in Inzpo.\n");
    expect(briefMarkdown(null, "none")).toBe("# Brief\n");
    expect(briefMarkdown(null, "ready")).toBe("# Brief\n");
    expect(briefMarkdown("Warm stone against shade.", "ready")).toBe("Warm stone against shade.\n");
    expect(briefMarkdown(null, "failed")).not.toContain("still running");
  });

  it("embeds a tile png in texture.svg and stays empty without one", () => {
    expect(textureSvg(null)).toContain("<svg");
    expect(textureSvg(null)).not.toContain("data:image/png");
    const svg = textureSvg(Buffer.from([137, 80, 78, 71]));
    expect(svg).toContain("data:image/png;base64,");
  });
});

describe("source pins", () => {
  it("numbers filled roles in token order", () => {
    const pins = pinNumbers([
      { role: "primary", position: 0 },
      { role: "background", position: 1 },
      { role: null, position: 2 },
    ]);
    expect(pins.primary).toBe(1);
    expect(pins.background).toBe(2);
    expect(pins.accent).toBeUndefined();
  });
});
