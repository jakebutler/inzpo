export type RevealMode = "play" | "landed" | "mid";
export type RevealPlan = "play" | "land" | "mid";

const played = new Set<string>();

function validKitId(kitId: string): boolean {
  return typeof kitId === "string" && kitId.length > 0;
}

/** True the first time this kit id plays; later calls skip so sheets/collections cannot restart it. */
export function claimRevealPlay(kitId: string, store: Set<string> = played): boolean {
  if (!validKitId(kitId)) return false;
  if (store.has(kitId)) return false;
  store.add(kitId);
  return true;
}

export function planReveal(kitId: string, mode: RevealMode, store: Set<string> = played): RevealPlan {
  if (mode === "landed") return "land";
  if (mode === "mid") return "mid";
  return claimRevealPlay(kitId, store) ? "play" : "land";
}

export function revealHasPlayed(kitId: string, store: Set<string> = played): boolean {
  return validKitId(kitId) && store.has(kitId);
}

export function resetReveal(kitId?: string, store: Set<string> = played): void {
  if (kitId) store.delete(kitId);
  else store.clear();
}

export function unclaimReveal(kitId: string, store: Set<string> = played): void {
  if (validKitId(kitId)) store.delete(kitId);
}
