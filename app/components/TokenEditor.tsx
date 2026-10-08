"use client";

import { useRef, useState, useTransition, type MutableRefObject } from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { hexWithoutHash, isHexColor, normalizeHex } from "@/lib/colors";
import { MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { filledRoles, moveRole, rolesFromColors, setRoleColor } from "@/lib/tokens";
import { pointerOnContainedImage, sampleImageAverage } from "@/lib/client-eyedropper";
import { saveItemTokensAction } from "@/app/actions/tokens";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chipCopy, chipNoun, EMPTY_ROLE_COPY, type NamedColor } from "@/lib/brief-copy";
import { PaletteBands } from "@/app/components/PaletteBands";
import { INK, PAPER, PIN_SIZE } from "@/lib/brand";

type ColorRow = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  position?: number;
};

const LOUPE_ZOOM = 3;
const LOUPE_PX = 80;

export function TokenEditor({
  itemId,
  imageSrc,
  colors,
  namedColors = [],
  initialOpen = null,
  size = "result",
  pageBackground = PAPER,
  pageInk = INK,
  bandRefs,
  onFocusRole,
}: {
  itemId: string;
  imageSrc: string | null;
  colors: ColorRow[];
  namedColors?: NamedColor[];
  initialOpen?: ColorRole | null;
  size?: "result" | "editor";
  pageBackground?: string;
  pageInk?: string;
  bandRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
  onFocusRole?: (role: ColorRole | null) => void;
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
  const img = imgRef.current;

  return (
    <section>
      <div data-band-stack>
        <PaletteBands
          roles={roles}
          size={size}
          pageBackground={pageBackground}
          onPick={openRole}
          onFocusRole={onFocusRole}
          bandRefs={bandRefs}
        />
      </div>
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 px-5">
          {chips.map((color) => {
            const noun = chipNoun(color.label, color.hex);
            return (
              <div
                key={color.hex}
                data-named-chip
                className="flex min-h-11 items-center gap-3 border border-solid px-3"
                style={{
                  borderWidth: 1,
                  animation: `inzpo-chip-in ${chipAnim} both`,
                  transitionDuration: `${MOTION_CSS.tapMs}ms`,
                }}
              >
                <span
                  aria-hidden
                  className="shrink-0 rounded-full"
                  style={{ width: PIN_SIZE, height: PIN_SIZE, backgroundColor: color.hex }}
                />
                <span className="font-mono text-base tabular-nums">#{hexWithoutHash(color.hex)}</span>
                <span className="min-w-0 flex-1 truncate text-base">{noun}</span>
                <button
                  type="button"
                  className="min-h-11 px-2 text-base"
                  aria-label={chipCopy(color.label, color.hex)}
                  onClick={() => onChip(color)}
                >
                  Add
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {pending ? <p className="mt-1 px-5 text-base">Saving…</p> : null}

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
        <SheetContent
          side="bottom"
          className="max-h-[85vh] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
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
                  className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
                  style={{
                    left: loupe.x,
                    top: loupe.y,
                    boxShadow: `0 0 0 2px ${pageInk}`,
                    backgroundImage: `url(${imageSrc})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: img
                      ? `${img.getBoundingClientRect().width * LOUPE_ZOOM}px ${img.getBoundingClientRect().height * LOUPE_ZOOM}px`
                      : `${LOUPE_ZOOM * 100}%`,
                    backgroundPosition: `${-(loupe.x * LOUPE_ZOOM - LOUPE_PX / 2)}px ${-(loupe.y * LOUPE_ZOOM - LOUPE_PX / 2)}px`,
                  }}
                >
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" style={{ color: pageInk }} />
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current" style={{ color: pageInk }} />
                </span>
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
              className="min-h-11 w-full border border-current bg-background px-3 font-mono text-base tabular-nums outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: pageInk }}
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
                    className="min-h-11 border px-2 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      transitionDuration: `${MOTION_CSS.tapMs}ms`,
                      borderColor: pageInk,
                      backgroundColor: selected ? pageInk : "transparent",
                      color: selected ? pageBackground : pageInk,
                      outlineColor: pageInk,
                    }}
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
