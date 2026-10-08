/** Display helpers for the reserved brief slot. Do not rewrite model text. */

/** Show the model brief as-is. CSS line-clamp is the overflow safety net. */
export function displayBriefSlot(text: string | null | undefined): string {
  if (typeof text !== "string") return "";
  return text.trim();
}
