import type { NamedColor } from "@/lib/brief-copy";

export type FoldPhotoId = "IMG_6505" | "IMG_6208" | "IMG_5859";

export type FoldBriefCapture = {
  text: string;
  namedColors: NamedColor[];
  latencyMs: number | null;
  model: string;
  outputTokens: number | null;
};

/** Captured from glm-5.3-flash against the sample photos. */
export const FOLD_BRIEFS: Record<FoldPhotoId, FoldBriefCapture> = {
  IMG_6505: {
    text: "Pale butter-yellow clapboard siding with white trim reads warm, dignified Victorian charm.",
    namedColors: [{"hex":"#eef0b4","label":"yellow siding"},{"hex":"#7e8c6a","label":"green shutters"}],
    latencyMs: 14096,
    model: "glm-5.3-flash",
    outputTokens: 93,
  },
  IMG_6208: {
    text: "Sky-blue mural facade with dark navy door insets and pale gray shopfront, evoking a quiet, storybook charm.",
    namedColors: [{"hex":"#4a7fb5","label":"slate-blue door panels"}],
    latencyMs: 5177,
    model: "glm-5.3-flash",
    outputTokens: 95,
  },
  IMG_5859: {
    text: "Rusty-orange zigzag peaks on a graffiti wall beside a pale blue-hazy sky, playful and mischievous in mood.",
    namedColors: [{"hex":"#d94f2b","label":"red zigzag mural"},{"hex":"#e08a2e","label":"orange spray paint"}],
    latencyMs: 4430,
    model: "glm-5.3-flash",
    outputTokens: 85,
  },
};
