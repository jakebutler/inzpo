import { BRIEF_PROMPT } from "@/lib/brief-prompt";

/** DigitalOcean Inference model id. The `openai/` prefix 404s on DO. */
export const DEFAULT_BRIEF_MODEL = "glm-5.3-flash";
export const BRIEF_MAX_DURATION_S = 60;
export const BRIEF_IMAGE_EXPIRES_S = 120;

export function briefModelId(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.BRIEF_MODEL ?? env.BRIEF_MODEL_URL ?? DEFAULT_BRIEF_MODEL).trim();
  const id = raw.replace(/^openai\//, "");
  return id.length > 0 ? id : DEFAULT_BRIEF_MODEL;
}

export type BriefContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function bytesToDataUrl(bytes: Uint8Array, mime = "image/webp"): string {
  if (bytes.byteLength === 0) throw new Error("Empty image");
  const type = mime.startsWith("image/") ? mime : "image/webp";
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function briefUserContent(keptHexes: string[], imageUrl: string): BriefContentPart[] {
  if (typeof imageUrl !== "string" || imageUrl.length === 0) {
    throw new Error("Brief image URL is required");
  }
  const hexes = keptHexes.filter((hex) => typeof hex === "string" && hex.length > 0);
  return [
    { type: "image_url", image_url: { url: imageUrl } },
    { type: "text", text: `Palette hexes already kept: ${hexes.join(", ") || "(none)"}.` },
  ];
}

export function buildBriefChatBody(input: {
  model: string;
  keptHexes: string[];
  imageUrl: string;
}): {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string | BriefContentPart[] }>;
  response_format: { type: "json_object" };
} {
  return {
    model: input.model,
    messages: [
      { role: "system", content: BRIEF_PROMPT },
      { role: "user", content: briefUserContent(input.keptHexes, input.imageUrl) },
    ],
    response_format: { type: "json_object" },
  };
}

export function parseBriefModelContent(content: string): {
  text?: string;
  namedColors?: unknown;
  namedHexes?: string[];
} {
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Empty brief");
  }
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Brief is not an object");
  return parsed as { text?: string; namedColors?: unknown; namedHexes?: string[] };
}

/** Call the vision model with a real image. Does not touch the database or R2. */
export async function requestBriefCompletion(input: {
  imageUrl: string;
  keptHexes: string[];
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ text: string | null; namedColors: unknown; namedHexes: string[]; latencyMs: number }> {
  if (typeof input.apiKey !== "string" || input.apiKey.length === 0) {
    throw new Error("Brief API key is required");
  }
  if (typeof input.imageUrl !== "string" || input.imageUrl.length === 0) {
    throw new Error("Brief image URL is required");
  }
  const model = input.model ?? briefModelId();
  const base = (input.baseUrl ?? "https://inference.do-ai.run/v1").replace(/\/$/, "");
  const fetchImpl = input.fetchImpl ?? fetch;
  const started = Date.now();
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(
      buildBriefChatBody({
        model,
        keptHexes: input.keptHexes,
        imageUrl: input.imageUrl,
      }),
    ),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) throw new Error("brief failed");
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  const parsed = content ? parseBriefModelContent(content) : {};
  return {
    text: typeof parsed.text === "string" ? parsed.text : null,
    namedColors: parsed.namedColors,
    namedHexes: Array.isArray(parsed.namedHexes)
      ? parsed.namedHexes.filter((hex): hex is string => typeof hex === "string")
      : [],
    latencyMs,
  };
}
