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
