import type { ColorRole } from "@/lib/db/schema";

// IMG_6505-like: visible cream siding close to the off-crop trim, with sky
// behind Back in a top-aligned cover crop. Roles without samples stay empty.
export const PIN_6505_COLORS: Array<{
  role: ColorRole; hex: string; pinX: number; pinY: number; position: number; origin: string;
}> = [
  { role: "primary", hex: "#d1cb9e", pinX: 0.417, pinY: 0.55, position: 0, origin: "region" },
  { role: "secondary", hex: "#a25938", pinX: 0.7, pinY: 0.65, position: 1, origin: "region" },
  { role: "accent", hex: "#426092", pinX: 0.075, pinY: 0.07, position: 2, origin: "region" },
  { role: "background", hex: "#d0c7b2", pinX: 0.393, pinY: 0.847, position: 3, origin: "region" },
  { role: "text", hex: "#0a0c0b", pinX: 0.56, pinY: 0.45, position: 5, origin: "region" },
];

// IMG_6208-like: secondary/text are 45.12px apart at 390px (43.38px at
// 375px). Drop 4's primary at (164,236) overlaps secondary's old hit target.
export const PIN_6208_COLORS: typeof PIN_6505_COLORS = [
  { role: "primary", hex: "#709fbe", pinX: 0.8107299, pinY: 0.54873717, position: 0, origin: "region" },
  { role: "secondary", hex: "#95a1ab", pinX: 151.3 / 390, pinY: 0.7015, position: 1, origin: "region" },
  { role: "background", hex: "#bac3c9", pinX: 207 / 390, pinY: 0.8514, position: 3, origin: "region" },
  { role: "surface", hex: "#9ec5de", pinX: 115 / 390, pinY: 0.2026, position: 4, origin: "region" },
  { role: "text", hex: "#384a5d", pinX: 112 / 390, pinY: 0.7441, position: 5, origin: "region" },
];
