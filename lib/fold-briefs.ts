import type { NamedColor } from "@/lib/brief-copy";
import { DEFAULT_BRIEF_MODEL } from "@/lib/brief-request";

export type FoldPhotoId = "IMG_6505" | "IMG_6208" | "IMG_5859";

export type FoldBriefCapture = {
  text: string;
  namedColors: NamedColor[];
  latencyMs: number | null;
  model: string;
};

/** Filled by `scripts/run-fold-briefs.mts` from glm-5.3-flash. Empty text means not captured yet. */
export const FOLD_BRIEFS: Record<FoldPhotoId, FoldBriefCapture> = {
  IMG_6505: {
    text: "",
    namedColors: [],
    latencyMs: null,
    model: DEFAULT_BRIEF_MODEL,
  },
  IMG_6208: {
    text: "",
    namedColors: [],
    latencyMs: null,
    model: DEFAULT_BRIEF_MODEL,
  },
  IMG_5859: {
    text: "",
    namedColors: [],
    latencyMs: null,
    model: DEFAULT_BRIEF_MODEL,
  },
};
