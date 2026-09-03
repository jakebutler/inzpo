"use client";

import { useMemo, useState } from "react";
import { mergeFacetValuesAction } from "./actions";

export interface MergeValue {
  id: string;
  value: string;
  usage: number;
}

export function MergeForm({ facetId, values }: { facetId: string; values: MergeValue[] }) {
  const [survivorId, setSurvivorId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const survivor = values.find((v) => v.id === survivorId);
  const folded = values.filter((v) => checked.has(v.id) && v.id !== survivorId);
  const itemsAffected = (survivor?.usage ?? 0) + folded.reduce((n, v) => n + v.usage, 0);
  const ready = !!survivor && folded.length > 0;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={mergeFacetValuesAction} className="mt-3 rounded-lg border border-neutral-800 p-2">
      <input type="hidden" name="facetId" value={facetId} />
      <p className="text-xs text-muted-foreground">Merge: pick the survivor, tick values to fold into it.</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <select
          name="survivorId"
          aria-label="Survivor"
          value={survivorId}
          onChange={(e) => setSurvivorId(e.target.value)}
          className="min-h-[36px] rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs"
        >
          {values.map((v) => (
            <option key={v.id} value={v.id}>
              {v.value}
            </option>
          ))}
        </select>
        {values.map((v) => (
          <label key={v.id} className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              name="mergeIds"
              value={v.id}
              checked={checked.has(v.id)}
              onChange={() => toggle(v.id)}
              className="accent-neutral-400"
            />
            {v.value}
          </label>
        ))}
        <button
          type="submit"
          disabled={!ready}
          className="min-h-[36px] rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-500 disabled:opacity-30"
        >
          merge
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground" aria-live="polite">
        {ready && survivor
          ? `Folding ${folded.map((v) => v.value).join(", ")} into “${survivor.value}” — ${itemsAffected} item${itemsAffected === 1 ? "" : "s"} will carry the survivor.`
          : "Pick a survivor and tick values to see the outcome."}
      </p>
    </form>
  );
}
