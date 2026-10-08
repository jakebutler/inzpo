import { COLOR_ROLES } from "@/lib/db/schema";
import { HANDOFF_KITS } from "@/lib/mascot";

/** First-screen sample: real IMG_6505 photo + its handoff palette. */
export const SAMPLE_KIT = {
  title: "Sample kit",
  imageSrc: "/sample/IMG_6505.jpg",
  hexes: COLOR_ROLES.map((role) => HANDOFF_KITS.IMG_6505[role]),
} as const;
