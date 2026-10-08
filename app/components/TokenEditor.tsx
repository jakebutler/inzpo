"use client";

import { useRef, useState, useTransition, type MutableRefObject } from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { isHexColor, normalizeHex } from "@/lib/colors";
import { MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { filledRoles, moveRole, rolesFromColors, setRoleColor } from "@/lib/tokens";
import { pointerOnContainedImage, sampleImageAverage } from "@/lib/client-eyedropper";
import { saveItemTokensAction } from "@/app/actions/tokens";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chipCopy, EMPTY_ROLE_COPY, type NamedColor } from "@/lib/brief-copy";
import { PaletteBands } from "@/app/components/PaletteBands";
import { ContrastAa } from "@/app/components/ContrastAa";
import { PAPER } from "@/lib/brand";

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
  size = "result",
  pageBackground = PAPER,
  bandRefs,
}: {
  itemId: string;
  imageSrc: string | null;
  colors: ColorRow[];
  namedColors?: NamedColor[];
  initialOpen?: ColorRole | null;
  size?: "result" | "editor";
  pageBackground?: string;
  bandRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
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
      <div data-band-stack>
        <PaletteBands
          roles={roles}
          size={size}
          pageBackground={pageBackground}
          onPick={openRole}
          bandRefs={bandRefs}
        />
      </div>
      <div className="mt-4">
        <ContrastAa roles={roles} />
      </div>
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 px-4">
          {chips.map((color) => (
            <button
              key={color.hex}
              type="button"
              className="min-h-11 border border-dashed border-current px-3 text-base"
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
      {pending ? <p className="mt-1 px-4 text-base">Saving…</p> : null}

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
        <SheetContent side="bottom" className="max-h-[85vh] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-none">
          <SheetHeader>
            <SheetTitle className="font-heading text-2xl">{open ? `Edit ${open}` : "Edit color"}</SheetTitle>
          </SheetHeader>
          {open && !roles[open] ? (
            <p className="px-4 text-base">{EMPTY_ROLE_COPY(open)}</p>
          ) : null}
          {imageSrc ? (
            <div className="relative mx-4 overflow-hidden">
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
                  className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
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
            <p className="px-4 text-base">No photo to sample from.</p>
          )}
          <div className="grid gap-3 px-4">
            <label className="block text-base" htmlFor="token-hex">
              Hex
            </label>
            <input
              id="token-hex"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={() => open && applyHex(open, hexDraft)}
              spellCheck={false}
              autoCapitalize="off"
              className="min-h-11 w-full border border-current bg-background px-3 font-mono text-base tabular-nums"
            />
            <p className="text-base">Role</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Role">
              {COLOR_ROLES.map((role) => {
                const selected = open === role;
                return (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`min-h-11 border px-2 text-base ${selected ? "border-current bg-secondary" : "border-current/30 bg-background"}`}
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
                className="min-h-11 text-base"
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
