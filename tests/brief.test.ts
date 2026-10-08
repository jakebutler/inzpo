import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRIEF_MAX_DURATION_S,
  DEFAULT_BRIEF_MODEL,
  briefModelId,
  briefUserContent,
  buildBriefChatBody,
  bytesToDataUrl,
} from "@/lib/brief-request";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("brief model id", () => {
  it("defaults to glm-5.3-flash without the openai/ prefix", () => {
    expect(DEFAULT_BRIEF_MODEL).toBe("glm-5.3-flash");
    expect(briefModelId({})).toBe("glm-5.3-flash");
    expect(briefModelId({ BRIEF_MODEL: "openai/glm-5.3-flash" })).toBe("glm-5.3-flash");
    expect(briefModelId({ BRIEF_MODEL: "glm-5.3-flash" })).toBe("glm-5.3-flash");
    expect(briefModelId({ BRIEF_MODEL_URL: "openai/glm-5.3-flash" })).toBe("glm-5.3-flash");
  });
});

describe("brief image payload", () => {
  it("sends the photo as an image_url content part with the kept hexes", () => {
    const dataUrl = bytesToDataUrl(Uint8Array.from([1, 2, 3]), "image/webp");
    expect(dataUrl).toMatch(/^data:image\/webp;base64,/);
    const parts = briefUserContent(["#6d6856"], dataUrl);
    expect(parts[0]).toEqual({ type: "image_url", image_url: { url: dataUrl } });
    expect(parts[1]).toEqual({ type: "text", text: "Palette hexes already kept: #6d6856." });
    const body = buildBriefChatBody({
      model: briefModelId({}),
      keptHexes: ["#6d6856"],
      imageUrl: dataUrl,
    });
    expect(body.model).toBe("glm-5.3-flash");
    const user = body.messages.find((m) => m.role === "user");
    expect(Array.isArray(user?.content)).toBe(true);
    expect(JSON.stringify(body)).toContain('"type":"image_url"');
    expect(JSON.stringify(body)).toContain(dataUrl);
    expect(src("lib/brief.ts")).toContain("w640ImageUrl");
    expect(src("lib/brief.ts")).toContain("buildBriefChatBody");
  });
});

describe("brief job lifetime", () => {
  it("schedules runBriefJob in after() so Save does not wait, with a 60s route budget", () => {
    expect(BRIEF_MAX_DURATION_S).toBe(60);
    const capture = src("app/capture/actions.ts");
    expect(capture).toMatch(/after\(async \(\) => \{\s*await runBriefJob\(itemId\);\s*\}\)/);
    expect(capture).not.toMatch(/void runBriefJob/);
    expect(capture).toMatch(/after\(async \(\) => \{\s*await runBriefJob\(itemId\);\s*\}\);\s*redirect\(`\/items\/\$\{itemId\}`\)/);
    const share = src("app/share/route.ts");
    expect(share).toMatch(/after\(async \(\) => \{\s*await runBriefJob\(itemId\);\s*\}\)/);
    expect(share).not.toMatch(/void runBriefJob/);
    expect(share).toContain("export const maxDuration = 60");
    expect(src("app/capture/page.tsx")).toContain("export const maxDuration = 60");
    expect(src("app/api/briefs/[id]/route.ts")).toContain("export const maxDuration = 60");
    expect(src("app/api/briefs/[id]/route.ts")).toContain("runBriefJob");
  });
});
