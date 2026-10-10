/** Display helpers for the reserved brief slot. Do not rewrite model text. */

/** Show the model brief as-is. Never ellipsize; the slot grows up to four 18/24 lines. */
export function displayBriefSlot(text: string | null | undefined): string {
  if (typeof text !== "string") return "";
  return text.trim();
}
