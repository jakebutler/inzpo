import { readFileSync } from "node:fs";
import path from "node:path";
import { BRIEF_PROMPT } from "@/lib/brief-prompt";
import { FOLD_BRIEFS } from "@/lib/fold-briefs";
import { describe, expect, it } from "vitest";
import {
  BRIEF_MAX_CHARS,
  BRIEF_MAX_DURATION_S,
  BRIEF_REQUEST,
  BriefTimeoutError,
  BriefTooLongError,
  DEFAULT_BRIEF_MODEL,
  acceptParsedBriefText,
  briefModelId,
  briefUserContent,
  buildBriefChatBody,
  bytesToDataUrl,
  parseBriefModelContent,
  requestBriefCompletion,
  requestBriefCompletionWithRetry,
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
    expect(body.reasoning_effort).toBe("low");
    expect(body.max_tokens).toBe(300);
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    const user = body.messages.find((m) => m.role === "user");
    expect(Array.isArray(user?.content)).toBe(true);
    expect(JSON.stringify(body)).toContain('"type":"image_url"');
    expect(JSON.stringify(body)).toContain(dataUrl);
    expect(src("lib/brief.ts")).toContain("w640ImageUrl");
    expect(src("lib/brief.ts")).toContain("requestBriefCompletion");
  });
});

describe("brief model path", () => {
  it("parses fenced JSON from the model", () => {
    const parsed = parseBriefModelContent('```json\n{"text":"Warm brick in shade.","namedColors":[]}\n```');
    expect(parsed.text).toBe("Warm brick in shade.");
  });

  it("calls the chat completions path with the real image", async () => {
    const calls: string[] = [];
    const result = await requestBriefCompletion({
      imageUrl: "data:image/webp;base64,AQID",
      keptHexes: ["#6b6656"],
      apiKey: "test-key",
      fetchImpl: (async (url, init) => {
        calls.push(String(url));
        expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"text":"Blue glass over shade.","namedColors":[]}' } }] }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    expect(calls[0]).toContain("/chat/completions");
    expect(result.text).toBe("Blue glass over shade.");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("turns a hung request into BriefTimeoutError so the job can fail", async () => {
    await expect(
      requestBriefCompletion({
        imageUrl: "data:image/webp;base64,AQID",
        keptHexes: ["#6b6656"],
        apiKey: "test-key",
        timeoutMs: 20,
        fetchImpl: ((_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          })) as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(BriefTimeoutError);
    expect(BRIEF_REQUEST.timeoutMs).toBe(25_000);
    expect(BRIEF_REQUEST.maxTokens).toBe(300);
    expect(BRIEF_REQUEST.reasoningEffort).toBe("low");
    expect(src("lib/brief.ts")).toContain("BriefTimeoutError");
    expect(src("lib/brief-request.ts")).toContain("BRIEF_REQUEST");
  });
});

describe("brief max chars", () => {
  it("treats parsed text over 120 characters as a parse failure and retries once", async () => {
    expect(BRIEF_MAX_CHARS).toBe(120);
    expect(BRIEF_REQUEST.maxChars).toBe(120);
    expect(acceptParsedBriefText("a".repeat(120))).toBe("a".repeat(120));
    expect(() => acceptParsedBriefText("a".repeat(121))).toThrow(BriefTooLongError);
    for (const capture of Object.values(FOLD_BRIEFS)) {
      expect(capture.text.length).toBeLessThanOrEqual(BRIEF_MAX_CHARS);
    }
    expect(FOLD_BRIEFS.IMG_6208.text.length).toBe(107);

    const tooLong = `{"text":"${"x".repeat(121)}","namedColors":[]}`;
    const ok = '{"text":"Warm brick in shade.","namedColors":[]}';
    const contents = [tooLong, ok];
    const result = await requestBriefCompletionWithRetry({
      imageUrl: "data:image/webp;base64,AQID",
      keptHexes: ["#6b6656"],
      apiKey: "test-key",
      fetchImpl: (async () => {
        const content = contents.shift();
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
      }) as typeof fetch,
    });
    expect(contents).toEqual([]);
    expect(result.text).toBe("Warm brick in shade.");

    await expect(
      requestBriefCompletionWithRetry({
        imageUrl: "data:image/webp;base64,AQID",
        keptHexes: ["#6b6656"],
        apiKey: "test-key",
        fetchImpl: (async () =>
          new Response(
            JSON.stringify({ choices: [{ message: { content: tooLong } }] }),
            { status: 200 },
          )) as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(BriefTooLongError);
    expect(src("lib/brief.ts")).toContain("requestBriefCompletionWithRetry");
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

  it("does not write env var names into the stub brief", () => {
    expect(src("lib/brief.ts")).not.toContain("DO_INFERENCE_API_KEY]");
    expect(src("lib/brief.ts")).not.toContain("no DO_INFERENCE");
  });
});

describe("brief prompt and v3 fixtures", () => {
  it("asks for one sentence of at most 12 words", () => {
    expect(BRIEF_PROMPT).toContain("Write one sentence of at most 12 words: cite photo details, then name the mood.");
    expect(BRIEF_PROMPT).not.toContain("Lead with cited photo details, then a few adjectives.");
  });

  it('uses a fixed prompt that prefers architectural styles independently of palette hexes', () => {
    expect(BRIEF_PROMPT).toContain('Victorian, Craftsman, Colonial, Bungalow, Ranch, Tudor');
    expect(BRIEF_PROMPT).toContain('Prefer that style over generic House, Home, Building or Townhouse');
    expect(BRIEF_PROMPT).toContain('Choose the same noun for the same photo, regardless of the palette hexes');
  });

  it("loads the W12-r1 v3 captures", () => {
    expect(FOLD_BRIEFS.IMG_6505.latencyMs).toBe(14096);
    expect(FOLD_BRIEFS.IMG_6208.latencyMs).toBe(5177);
    expect(FOLD_BRIEFS.IMG_5859.latencyMs).toBe(4430);
    expect(FOLD_BRIEFS.IMG_6505.outputTokens).toBe(93);
    expect(FOLD_BRIEFS.IMG_6505.text).toContain("Pale butter-yellow");
  });
});
