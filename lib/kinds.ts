import { IMAGE_KINDS, LINKED_KINDS, type ItemKind } from "@/lib/db/schema";

/** URL / article / video stay in the data model but are hidden from capture and the Wall. */
export const HIDDEN_CAPTURE_KINDS = LINKED_KINDS;
export const WALL_VISIBLE_KINDS = [...IMAGE_KINDS, "palette"] as const satisfies readonly ItemKind[];

export function isWallVisibleKind(kind: string): boolean {
  return (WALL_VISIBLE_KINDS as readonly string[]).includes(kind);
}

export function isHiddenCaptureKind(kind: string): boolean {
  return (HIDDEN_CAPTURE_KINDS as readonly string[]).includes(kind);
}
