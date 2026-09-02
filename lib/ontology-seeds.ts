export interface FacetSeed {
  name: string;
  position: number;
  values: string[];
}

export const FACET_SEEDS: FacetSeed[] = [
  {
    name: "Style",
    position: 1,
    values: ["minimal", "brutalist", "swiss", "editorial", "retro", "futuristic", "maximalist", "organic"],
  },
  {
    name: "Usage",
    position: 2,
    values: ["dashboard", "landing page", "pricing page", "mobile app", "e-commerce", "portfolio", "onboarding", "email"],
  },
  {
    name: "Medium",
    position: 3,
    values: ["web", "mobile", "print", "motion", "packaging", "environmental", "social"],
  },
  {
    name: "Format",
    position: 4,
    values: ["poster", "logo", "icon set", "banner", "business card", "typographic specimen", "UI kit", "layout"],
  },
  {
    name: "Mood",
    position: 5,
    values: ["calm", "energetic", "moody", "cozy", "dramatic", "whimsical"],
  },
  {
    name: "Complexity",
    position: 6,
    values: ["sparse", "airy", "balanced", "rich", "dense"],
  },
];
