"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { hexWithoutHash, isHexColor, normalizeHex } from "@/lib/colors";
import { MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { filledRoles, moveRole, pinNumbers, rolesFromColors, setRoleColor } from "@/lib/tokens";
import { pointerOnContainedImage, sampleImageAverage } from "@/lib/client-eyedropper";
import { saveItemTokensAction } from "@/app/actions/tokens";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { contrastLineCopy, swatchHairline, swatchInk } from "@/lib/contrast";
import { chipCopy, EMPTY_ROLE_COPY, type NamedColor } from "@/lib/brief-copy";

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
  namedColors = [],
  initialOpen = null,
}: {
  itemId: string;
  imageSrc: string | null;
  colors: ColorRow[];
  namedColors?: NamedColor[];
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
  const [hexDraft, setHexDraft] = useState(() => (initialOpen ? rolesFromColors(colors)[initialOpen] ?? "" : ""));
  const [pendingHex, setPendingHex] = useState<string | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number; hex: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const imgRef = useRef<HTMLImageElement>(null);
  const numbers = useMemo(() => pinNumbers(colors), [colors]);
  const contrastLine = contrastLineCopy(roles);
  const filledHex = new Set(
    Object.values(roles)
      .filter((hex): hex is string => typeof hex === "string")
      .map((hex) => hex.toLowerCase()),
  );
  const chips = namedColors.filter((c) => !filledHex.has(c.hex.toLowerCase()));

  function openRole(role: ColorRole) {
    setOpen(role);
    setHexDraft(pendingHex ?? roles[role] ?? "");
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
    setPendingHex(null);
  }

  function onChip(color: NamedColor) {
    const empty = COLOR_ROLES.find((role) => !roles[role]);
    if (empty) {
      commit(setRoleColor(roles, empty, color.hex));
      return;
    }
    setPendingHex(color.hex);
    openRole(open ?? "primary");
    setHexDraft(color.hex);
  }

  function sampleAt(clientX: number, clientY: number) {
    if (!open || !imgRef.current) return;
    const mapped = pointerOnContainedImage(imgRef.current, clientX, clientY);
    if (!mapped) return;
    try {
      const sample = sampleImageAverage(imgRef.current, mapped.nx, mapped.ny, 8);
      const nextPins = { ...pins, [open]: { pinX: sample.pinX, pinY: sample.pinY } };
      commit(setRoleColor(roles, open, sample.hex), nextPins);
      setHexDraft(sample.hex);
      setPendingHex(null);
      const rect = imgRef.current.getBoundingClientRect();
      setLoupe({ x: clientX - rect.left, y: clientY - rect.top, hex: sample.hex });
    } catch {
      // keep the previous color if the image cannot be sampled
    }
  }

  const reduced = prefersReducedMotion();
  const chipAnim = reduced
    ? `${MOTION_CSS.reducedMs}ms ${MOTION_CSS.easeEnter}`
    : `${MOTION_CSS.enterMs}ms ${MOTION_CSS.easeEnter}`;

  return (
    <section>
      <div className="inzpo-swatches">
        {COLOR_ROLES.map((role) => {
          const hex = roles[role];
          if (!hex) {
            return (
              <button
                key={role}
                type="button"
                onClick={() => openRole(role)}
                aria-label={EMPTY_ROLE_COPY(role)}
                className="inzpo-swatch min-h-11 rounded-lg active:scale-[0.98]"
                style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
              >
                <span className="inzpo-swatch-empty">
                  <span className="inzpo-swatch-empty-copy">{EMPTY_ROLE_COPY(role)}</span>
                  <span className="inzpo-swatch-empty-mark" aria-hidden>
                    +
                  </span>
                </span>
              </button>
            );
          }
          const ink = swatchInk(hex);
          const hair = swatchHairline(hex);
          return (
            <button
              key={role}
              type="button"
              onClick={() => openRole(role)}
              aria-label={`${role} ${hex}${numbers[role] ? `, pin ${numbers[role]}` : ""}`}
              className="inzpo-swatch min-h-11 rounded-lg active:scale-[0.98]"
              style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
            >
              <span
                className="inzpo-swatch-fill"
                style={{
                  backgroundColor: hex,
                  color: ink,
                  boxShadow: `inset 0 0 0 1px ${hair}`,
                }}
              >
                <span className="inzpo-swatch-role text-[11px] font-medium leading-none">{role}</span>
                <span className="inzpo-swatch-meta font-mono text-[11px] tabular-nums leading-none">
                  {hex}
                  {numbers[role] ? ` · ${numbers[role]}` : ""}
                </span>
              </span>
              <span className="inzpo-swatch-hex" data-swatch-hex>
                {hexWithoutHash(hex)}
              </span>
            </button>
          );
        })}
      </div>
      <p data-contrast-line className="mt-3 text-base leading-snug text-muted-foreground">
        {contrastLine}
      </p>
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((color) => (
            <button
              key={color.hex}
              type="button"
              className="min-h-11 rounded-full border border-dashed border-border px-3 text-base"
              style={{
                animation: `inzpo-chip-in ${chipAnim} both`,
                transitionDuration: `${MOTION_CSS.tapMs}ms`,
              }}
              onClick={() => onChip(color)}
            >
              {chipCopy(color.label)}
            </button>
          ))}
        </div>
      ) : null}
      {pending ? <p className="mt-1 text-base text-muted-foreground">Saving…</p> : null}

      <Sheet
        open={open !== null}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null);
            setLoupe(null);
            setPendingHex(null);
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl bg-background pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground">
          <SheetHeader>
            <SheetTitle>{open ? `Edit ${open}` : "Edit color"}</SheetTitle>
          </SheetHeader>
          {open && !roles[open] ? (
            <p className="px-4 text-base text-muted-foreground">{EMPTY_ROLE_COPY(open)}</p>
          ) : null}
          {imageSrc ? (
            <div className="relative mx-4 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Sample a color"
                crossOrigin="anonymous"
                className="max-h-56 w-full cursor-crosshair object-contain"
                onClick={(e) => sampleAt(e.clientX, e.clientY)}
                onPointerMove={(e) => {
                  if (!imgRef.current) return;
                  const mapped = pointerOnContainedImage(imgRef.current, e.clientX, e.clientY);
                  if (!mapped) {
                    setLoupe(null);
                    return;
                  }
                  try {
                    const sample = sampleImageAverage(imgRef.current, mapped.nx, mapped.ny, 8);
                    const rect = imgRef.current.getBoundingClientRect();
                    setLoupe({ x: e.clientX - rect.left, y: e.clientY - rect.top, hex: sample.hex });
                  } catch {
                    setLoupe(null);
                  }
                }}
                onPointerLeave={() => setLoupe(null)}
              />
              {loupe ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-lg"
                  style={{
                    left: loupe.x,
                    top: loupe.y,
                    borderColor: loupe.hex,
                    backgroundImage: `url(${imageSrc})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: imgRef.current
                      ? `${imgRef.current.naturalWidth * 2.5}px ${imgRef.current.naturalHeight * 2.5}px`
                      : "250%",
                    backgroundPosition: imgRef.current
                      ? `${-(loupe.x * 2.5 - 40)}px ${-(loupe.y * 2.5 - 40)}px`
                      : "center",
                  }}
                />
              ) : null}
            </div>
          ) : (
            <p className="px-4 text-base text-muted-foreground">No photo to sample from.</p>
          )}
          <div className="grid gap-3 px-4">
            <label className="block text-base text-muted-foreground" htmlFor="token-hex">
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
            <p className="text-base text-muted-foreground">Role</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Role">
              {COLOR_ROLES.map((role) => {
                const selected = open === role;
                return (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`min-h-11 rounded-lg border px-2 text-base ${selected ? "border-foreground bg-muted" : "border-border bg-background"}`}
                    style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
                    onClick={() => {
                      if (!open || role === open) {
                        if (pendingHex) applyHex(role, pendingHex);
                        return;
                      }
                      if (pendingHex) {
                        applyHex(role, pendingHex);
                        setOpen(role);
                        return;
                      }
                      commit(moveRole(roles, open, role));
                      setOpen(role);
                    }}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
            {open && filledRoles(roles).includes(open) ? (
              <button
                type="button"
                className="min-h-11 text-base text-muted-foreground"
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
