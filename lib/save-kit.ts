/** A second Save tap must not create another membership. */
export function canSaveKit(input: { saved: boolean; pending: boolean }): boolean {
  return !input.saved && !input.pending;
}
