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
