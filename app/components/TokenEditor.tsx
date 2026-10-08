"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { isHexColor, normalizeHex } from "@/lib/colors";
import { MOTION_CSS } from "@/lib/motion";
import { moveRole, pinNumbers, rolesFromColors, setRoleColor } from "@/lib/tokens";
import { sampleImageAverage } from "@/lib/client-eyedropper";
import { saveItemTokensAction } from "@/app/actions/tokens";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { textOnBackgroundContrast } from "@/lib/palette-extract";

type ColorRow = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  position?: number;
};

export function TokenEditor({
  itemId,
  imageSrc,
  colors,
  namedHexes = [],
  initialOpen = null,
}: {
  itemId: string;
  imageSrc: string | null;
  colors: ColorRow[];
  namedHexes?: string[];
  initialOpen?: ColorRole | null;
}) {
  const [roles, setRoles] = useState(() => rolesFromColors(colors));
  const [pins, setPins] = useState<Partial<Record<ColorRole, { pinX: number; pinY: number }>>>(() => {
    const next: Partial<Record<ColorRole, { pinX: number; pinY: number }>> = {};
    for (const c of colors) {
      if (c.role && c.pinX != null && c.pinY != null) next[c.role] = { pinX: c.pinX, pinY: c.pinY };
    }
    return next;
  });
  const [open, setOpen] = useState<ColorRole | null>(initialOpen);
  const [hexDraft, setHexDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const imgRef = useRef<HTMLImageElement>(null);
  const numbers = useMemo(() => pinNumbers(colors), [colors]);
  const contrast = textOnBackgroundContrast(roles);
  const filledHex = new Set(
    Object.values(roles)
      .filter((hex): hex is string => typeof hex === "string")
      .map((hex) => hex.toLowerCase()),
  );
  const chips = namedHexes.filter((hex) => !filledHex.has(hex.toLowerCase()));

  function openRole(role: ColorRole) {
    setOpen(role);
    setHexDraft(roles[role] ?? "");
  }

  function commit(nextRoles: typeof roles, nextPins = pins) {
    setRoles(nextRoles);
    setPins(nextPins);
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("roles", JSON.stringify(nextRoles));
    fd.set("pins", JSON.stringify(nextPins));
    startTransition(() => {
      void saveItemTokensAction(fd);
    });
  }

  function applyHex(role: ColorRole, value: string) {
    if (!isHexColor(value)) return;
    commit(setRoleColor(roles, role, normalizeHex(value)));
    setHexDraft(normalizeHex(value));
  }

  function onPhotoClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!open || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    try {
      const sample = sampleImageAverage(imgRef.current, nx, ny, 8);
      const nextPins = { ...pins, [open]: { pinX: sample.pinX, pinY: sample.pinY } };
      commit(setRoleColor(roles, open, sample.hex), nextPins);
      setHexDraft(sample.hex);
    } catch {
      // keep the previous color if the image cannot be sampled
    }
  }

  return (
    <section>
      <div className="grid grid-cols-3 gap-2">
        {COLOR_ROLES.map((role) => {
          const hex = roles[role];
          if (!hex) {
            return (
              <button
                key={role}
                type="button"
                onClick={() => openRole(role)}
                aria-label={`Add a color for ${role}`}
                className="flex min-h-16 items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 text-[11px] text-muted-foreground active:scale-[0.98]"
                style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
              >
                add a color
              </button>
            );
          }
          return (
            <button
              key={role}
              type="button"
              onClick={() => openRole(role)}
              aria-label={`${role} ${hex}${numbers[role] ? `, pin ${numbers[role]}` : ""}`}
              className="flex min-h-16 flex-col items-start justify-between rounded-lg px-2 py-1.5 text-left active:scale-[0.98]"
              style={{ backgroundColor: hex, transitionDuration: `${MOTION_CSS.tapMs}ms` }}
            >
              <span className="text-[10px] font-medium text-white/90 mix-blend-difference">{role}</span>
              <span className="text-[11px] tabular-nums text-white/90 mix-blend-difference">
                {hex}
                {numbers[role] ? ` · ${numbers[role]}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      {contrast != null ? (
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          Text on background {contrast.toFixed(1)}:1
        </p>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((hex) => (
            <button
              key={hex}
              type="button"
              className="rounded-full border border-dashed border-border px-3 py-2 text-xs"
              onClick={() => {
                const empty = COLOR_ROLES.find((role) => !roles[role]);
                if (!empty) return;
                commit(setRoleColor(roles, empty, hex));
              }}
            >
              add this swatch {hex}
            </button>
          ))}
        </div>
      ) : null}
      {pending ? <p className="mt-1 text-[11px] text-muted-foreground">Saving…</p> : null}

      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{open ? `Edit ${open}` : "Edit color"}</SheetTitle>
          </SheetHeader>
          {imageSrc ? (
            <div className="relative mx-4 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Sample a color"
                crossOrigin="anonymous"
                className="max-h-56 w-full cursor-crosshair object-contain"
                onClick={onPhotoClick}
              />
            </div>
          ) : (
            <p className="px-4 text-sm text-muted-foreground">No photo to sample from.</p>
          )}
          <div className="grid gap-3 px-4">
            <label className="block text-xs uppercase tracking-wide text-muted-foreground" htmlFor="token-hex">
              Hex
            </label>
            <input
              id="token-hex"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={() => open && applyHex(open, hexDraft)}
              spellCheck={false}
              autoCapitalize="off"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base tabular-nums"
            />
            <label className="block text-xs uppercase tracking-wide text-muted-foreground" htmlFor="token-role">
              Role
            </label>
            <select
              id="token-role"
              value={open ?? "primary"}
              onChange={(e) => {
                const next = e.target.value as ColorRole;
                if (!open || next === open) return;
                commit(moveRole(roles, open, next));
                setOpen(next);
              }}
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
            >
              {COLOR_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {open && roles[open] ? (
              <button
                type="button"
                className="min-h-11 text-sm text-muted-foreground"
                onClick={() => {
                  commit(setRoleColor(roles, open, null));
                  setOpen(null);
                }}
              >
                Clear this role
              </button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
