"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { hexWithoutHash, isHexColor, normalizeHex } from "@/lib/colors";
import { MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { filledRoles, moveRole, rolesFromColors, setRoleColor } from "@/lib/tokens";
import { sampleImageAverage, sampleImagePixel } from "@/lib/client-eyedropper";
import { isNoopPinDrag, isNoopPinSample, resolvePinDropPoint, type PinDragPoint, type PointerPoint } from "@/lib/pin-drag";
import { SAMPLED_ORIGIN } from "@/lib/derived-roles";
import { pointerOnCoverBox, type CoverWindow } from "@/lib/cover-pin";
import { saveItemTokensAction } from "@/app/actions/tokens";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chipCopy, chipNoun, EMPTY_ROLE_COPY, type NamedColor } from "@/lib/brief-copy";
import { PaletteBands } from "@/app/components/PaletteBands";
import { CHIP_SWATCH_PX, INK, PAPER } from "@/lib/brand";

export type LoupeView = { x: number; y: number; hex: string };

type ColorRow = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  position?: number;
  derivedFrom?: ColorRole | null;
  origin?: string | null;
};

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
  onOpenChange,
  photoRef,
  photoBox,
  crop,
  imageSize,
  simulateLoupe = false,
  onLoupe,
  onPromoteRole,
  bandsRevealed = true,
  children,
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
  onOpenChange?: (role: ColorRole | null) => void;
  photoRef?: RefObject<HTMLImageElement | null>;
  photoBox?: { w: number; h: number };
  crop?: CoverWindow | null;
  imageSize?: { width: number; height: number };
  simulateLoupe?: boolean;
  onLoupe?: (loupe: LoupeView | null) => void;
  onPromoteRole?: (role: ColorRole, pin: { pinX: number; pinY: number; hex: string }) => void;
  bandsRevealed?: boolean;
  children?: ReactNode;
}) {
  const [roles, setRoles] = useState(() => rolesFromColors(colors));
  const [pins, setPins] = useState<Partial<Record<ColorRole, { pinX: number; pinY: number }>>>(() => {
    const next: Partial<Record<ColorRole, { pinX: number; pinY: number }>> = {};
    for (const c of colors) {
      if (c.role && c.pinX != null && c.pinY != null) next[c.role] = { pinX: c.pinX, pinY: c.pinY };
    }
    return next;
  });
  const [autoRoles, setAutoRoles] = useState<Set<ColorRole>>(
    () => new Set(colors.filter((c) => c.role && c.derivedFrom).map((c) => c.role!)),
  );
  const [userSetRoles, setUserSetRoles] = useState<Set<ColorRole>>(
    () => new Set(colors.filter((c) => c.role && c.origin === SAMPLED_ORIGIN).map((c) => c.role!)),
  );
  const [open, setOpen] = useState<ColorRole | null>(initialOpen);
  const [hexDraft, setHexDraft] = useState(() => (initialOpen ? rolesFromColors(colors)[initialOpen] ?? "" : ""));
  const [pendingHex, setPendingHex] = useState<string | null>(null);
  function setLoupe(next: LoupeView | null) {
    onLoupe?.(next);
  }
  const [pending, startTransition] = useTransition();
  const filledHex = new Set(
    Object.values(roles)
      .filter((hex): hex is string => typeof hex === "string")
      .map((hex) => hex.toLowerCase()),
  );
  const chips = namedColors.filter((c) => !filledHex.has(c.hex.toLowerCase()));

  function setOpenRole(role: ColorRole | null) {
    setOpen(role);
    onOpenChange?.(role);
    if (!role) setLoupe(null);
  }

  function openRole(role: ColorRole) {
    setOpenRole(role);
    setHexDraft(pendingHex ?? roles[role] ?? "");
    if (autoRoles.has(role) && photoBox) {
      setLoupe({ x: photoBox.w / 2, y: photoBox.h / 2, hex: roles[role] ?? "#000000" });
    }
  }

  function commit(nextRoles: typeof roles, nextPins = pins, nextUserSet = userSetRoles) {
    setRoles(nextRoles);
    setPins(nextPins);
    setUserSetRoles(nextUserSet);
    const origins: Partial<Record<ColorRole, string>> = {};
    for (const role of COLOR_ROLES) {
      if (nextUserSet.has(role)) origins[role] = SAMPLED_ORIGIN;
    }
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("roles", JSON.stringify(nextRoles));
    fd.set("pins", JSON.stringify(nextPins));
    fd.set("origins", JSON.stringify(origins));
    startTransition(async () => {
      await saveItemTokensAction(fd);
    });
  }

  function applyHex(role: ColorRole, value: string, nextPins = pins, markUserSet = true) {
    if (!isHexColor(value)) return;
    if (normalizeHex(value) === roles[role] && nextPins === pins) {
      setHexDraft(normalizeHex(value));
      return;
    }
    const nextUserSet = new Set(userSetRoles);
    if (markUserSet) nextUserSet.add(role);
    commit(setRoleColor(roles, role, normalizeHex(value)), nextPins, nextUserSet);
    setHexDraft(normalizeHex(value));
    setPendingHex(null);
  }

  function onChip(color: NamedColor) {
    const empty = COLOR_ROLES.find((role) => !roles[role]);
    if (empty) {
      const nextUserSet = new Set(userSetRoles);
      nextUserSet.add(empty);
      commit(setRoleColor(roles, empty, color.hex), pins, nextUserSet);
      return;
    }
    setPendingHex(color.hex);
    openRole(open ?? "primary");
    setHexDraft(color.hex);
  }

  function resetSamplePreview() {
    setLoupe(null);
    if (open) setHexDraft(roles[open] ?? "");
  }

  function samplePointer(clientX: number, clientY: number, commitSample: boolean, start?: PinDragPoint | null) {
    const img = photoRef?.current;
    if (!open || !img || !crop) return null;
    const rect = img.getBoundingClientRect();
    const mapped = pointerOnCoverBox(clientX, clientY, rect, crop);
    if (!mapped) {
      if (commitSample) resetSamplePreview();
      return null;
    }
    const geometry = {
      width: img.naturalWidth, height: img.naturalHeight,
      boxWidth: rect.width, boxHeight: rect.height, crop,
    };
    try {
      if (commitSample && (isNoopPinDrag(start, mapped, geometry) || isNoopPinSample(pins[open], mapped, geometry))) {
        resetSamplePreview();
        return mapped;
      }
      const sample = commitSample
        ? sampleImagePixel(img, mapped.nx, mapped.ny)
        : sampleImageAverage(img, mapped.nx, mapped.ny, 8);
      setLoupe({ x: mapped.x, y: mapped.y, hex: sample.hex });
      if (commitSample) {
        const nextPins = { ...pins, [open]: { pinX: sample.pinX, pinY: sample.pinY } };
        setAutoRoles((prev) => {
          const next = new Set(prev);
          next.delete(open);
          return next;
        });
        onPromoteRole?.(open, { pinX: sample.pinX, pinY: sample.pinY, hex: sample.hex });
        applyHex(open, sample.hex, nextPins, true);
      } else {
        setHexDraft(sample.hex);
      }
    } catch {
      // keep the previous color if the image cannot be sampled
      if (commitSample) resetSamplePreview();
    }
    return mapped;
  }

  // Loupe updates render the parent on every move. Keep the native listeners and
  // their active pointer intact, while sampling with the latest role/crop/state.
  const pointerHandlers = useRef({ samplePointer, resetSamplePreview });
  useEffect(() => {
    pointerHandlers.current = { samplePointer, resetSamplePreview };
  });

  useEffect(() => {
    const img = photoRef?.current;
    if (!open || !img) return;
    const previousPointerEvents = img.style.pointerEvents;
    const previousTouchAction = img.style.touchAction;
    img.style.pointerEvents = "auto";
    img.style.touchAction = "none";
    let active: { pointerId: number; start: PinDragPoint; lastGood: PointerPoint } | null = null;
    const preventNativeDrag = (e: DragEvent) => e.preventDefault();
    const onDown = (e: PointerEvent) => {
      if (active || !e.isPrimary || e.button !== 0) return;
      const start = pointerHandlers.current.samplePointer(e.clientX, e.clientY, false);
      if (!start) return;
      // Images are natively draggable in Chromium: without this, dragstart
      // cancels our pointer stream and reports (0, 0) instead of a drop.
      e.preventDefault();
      active = { pointerId: e.pointerId, start, lastGood: { clientX: e.clientX, clientY: e.clientY } };
      img.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!active || active.pointerId !== e.pointerId) return;
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      active.lastGood = { clientX: e.clientX, clientY: e.clientY };
      pointerHandlers.current.samplePointer(e.clientX, e.clientY, false);
    };
    const onUp = (e: PointerEvent) => {
      if (!active || active.pointerId !== e.pointerId) return;
      const drag = active;
      active = null;
      const point = resolvePinDropPoint(e, drag.lastGood);
      if (point) pointerHandlers.current.samplePointer(point.clientX, point.clientY, true, drag.start);
      else pointerHandlers.current.resetSamplePreview();
      if (img.hasPointerCapture(e.pointerId)) img.releasePointerCapture(e.pointerId);
    };
    const onLostCapture = (e: PointerEvent) => {
      if (!active || active.pointerId !== e.pointerId) return;
      active = null;
      pointerHandlers.current.resetSamplePreview();
    };
    img.addEventListener("dragstart", preventNativeDrag);
    img.addEventListener("pointerdown", onDown);
    img.addEventListener("pointermove", onMove);
    img.addEventListener("pointerup", onUp);
    img.addEventListener("pointercancel", onUp);
    img.addEventListener("lostpointercapture", onLostCapture);
    return () => {
      if (active && img.hasPointerCapture(active.pointerId)) img.releasePointerCapture(active.pointerId);
      active = null;
      img.style.pointerEvents = previousPointerEvents;
      img.style.touchAction = previousTouchAction;
      img.removeEventListener("dragstart", preventNativeDrag);
      img.removeEventListener("pointerdown", onDown);
      img.removeEventListener("pointermove", onMove);
      img.removeEventListener("pointerup", onUp);
      img.removeEventListener("pointercancel", onUp);
      img.removeEventListener("lostpointercapture", onLostCapture);
    };
  }, [open, photoRef]);

  useEffect(() => {
    if (!simulateLoupe || !open || !crop || !photoBox || !imageSize) return;
    const hex = roles[open] ?? "#000000";
    if (autoRoles.has(open)) {
      setLoupe({ x: photoBox.w / 2, y: photoBox.h / 2, hex });
      return;
    }
    const pin = pins[open];
    if (!pin) {
      setLoupe({ x: photoBox.w / 2, y: photoBox.h / 2, hex });
      return;
    }
    const left = ((pin.pinX - crop.vx) / crop.vw) * photoBox.w;
    const top = ((pin.pinY - crop.vy) / crop.vh) * photoBox.h;
    setLoupe({ x: left, y: top, hex });
  }, [simulateLoupe, open, crop, photoBox, imageSize, pins, roles, autoRoles]);

  const reduced = prefersReducedMotion();
  const chipAnim = reduced
    ? `${MOTION_CSS.reducedMs}ms ${MOTION_CSS.easeEnter}`
    : `${MOTION_CSS.enterMs}ms ${MOTION_CSS.easeEnter}`;

  return (
    <section>
      <div data-band-stack data-revealed={bandsRevealed ? "true" : "false"}>
        <PaletteBands
          roles={roles}
          size={size}
          pageBackground={pageBackground}
          onPick={openRole}
          onFocusRole={onFocusRole}
          bandRefs={bandRefs}
          autoRoles={autoRoles}
        />
      </div>
      {children}
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
                  data-chip-swatch
                  className="shrink-0 rounded-full"
                  style={{
                    width: CHIP_SWATCH_PX,
                    height: CHIP_SWATCH_PX,
                    minWidth: CHIP_SWATCH_PX,
                    minHeight: CHIP_SWATCH_PX,
                    backgroundColor: color.hex,
                  }}
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
      {pending ? <p data-token-saving className="mt-1 px-5 text-base">Saving…</p> : null}

      <Sheet
        open={open !== null}
        onOpenChange={(v) => {
          if (!v) {
            setOpenRole(null);
            setPendingHex(null);
          }
        }}
      >
        <SheetContent
          side="bottom"
          overlayClassName="inzpo-photo-clear"
          className="max-h-[calc(100dvh-var(--photo-fold-h,337px))] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            // The sticky photo is an editing surface outside the sheet portal.
            if (event.detail.originalEvent.target === photoRef?.current) event.preventDefault();
          }}
        >
          <SheetHeader>
            <SheetTitle className="font-heading text-2xl">{open ? `Edit ${open}` : "Edit color"}</SheetTitle>
          </SheetHeader>
          {open && !roles[open] ? (
            <p className="px-4 text-base">{EMPTY_ROLE_COPY(open)}</p>
          ) : null}
          {!imageSrc ? <p className="px-4 text-base">No photo to sample from.</p> : null}
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
                        setOpenRole(role);
                        return;
                      }
                      commit(moveRole(roles, open, role));
                      setOpenRole(role);
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
                  setOpenRole(null);
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
