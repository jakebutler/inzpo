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
import { FIX_ORIGIN, REGION_ORIGIN, sampledColors, SAMPLED_ORIGIN } from "@/lib/derived-roles";
import { pageChromeColors, textContrastFix, textOnBackgroundContrast } from "@/lib/contrast";
import { kitWearStyle } from "@/lib/kit-wear";
import { layoutPins, mapCoverPinRaw, photoBackZone, pointerOnCoverBox, type CoverWindow } from "@/lib/cover-pin";
import { saveItemTokensAction } from "@/app/actions/tokens";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chipCopy, chipNoun, EMPTY_ROLE_COPY, parseNamedColors, type NamedColor } from "@/lib/brief-copy";
import { PaletteBands } from "@/app/components/PaletteBands";
import { ContrastAa } from "./ContrastAa";
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
  onPinDrag,
  onPromoteRole,
  onColorsChange,
  showContrast = false,
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
  onPinDrag?: (pin: { role: ColorRole; x: number; y: number } | null) => void;
  onPromoteRole?: (role: ColorRole, pin: { pinX: number; pinY: number; hex: string }) => void;
  onColorsChange?: (colors: ColorRow[]) => void;
  showContrast?: boolean;
  bandsRevealed?: boolean;
  children?: ReactNode;
}) {
  const [roles, setRoles] = useState(() => rolesFromColors(colors));
  const [pins, setPins] = useState<Partial<Record<ColorRole, { pinX: number; pinY: number }>>>(() => {
    const next: Partial<Record<ColorRole, { pinX: number; pinY: number }>> = {};
    for (const c of sampledColors(colors)) {
      if (c.role && c.pinX != null && c.pinY != null) next[c.role] = { pinX: c.pinX, pinY: c.pinY };
    }
    return next;
  });
  const [origins, setOrigins] = useState<Partial<Record<ColorRole, string>>>(() => Object.fromEntries(
    sampledColors(colors).filter((c) => c.role).map((c) => [c.role!,
      c.origin === FIX_ORIGIN || c.origin === SAMPLED_ORIGIN ? c.origin :
        c.pinX != null && c.pinY != null ? REGION_ORIGIN : SAMPLED_ORIGIN,
    ]),
  ));
  const [history, setHistory] = useState<Array<{ roles: typeof roles; pins: typeof pins; origins: typeof origins }>>([]);
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
  const chips = COLOR_ROLES.some((role) => !roles[role])
    ? parseNamedColors(namedColors).filter((c) => !filledHex.has(c.hex.toLowerCase()))
    : [];

  function setOpenRole(role: ColorRole | null) {
    setOpen(role);
    onOpenChange?.(role);
    if (!role) {
      setLoupe(null);
      onPinDrag?.(null);
    }
  }

  function openRole(role: ColorRole) {
    setOpenRole(role);
    setHexDraft(pendingHex ?? roles[role] ?? "");
  }

  function commit(nextRoles: typeof roles, nextPins = pins, nextOrigins = origins, remember = true) {
    if (remember) setHistory((prev) => [...prev, { roles, pins, origins }]);
    setRoles(nextRoles);
    setPins(nextPins);
    setOrigins(nextOrigins);
    onColorsChange?.(COLOR_ROLES.flatMap((role, position) => nextRoles[role] ? [{
      role, position, hex: nextRoles[role]!, origin: nextOrigins[role], ...nextPins[role],
    }] : []));
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("roles", JSON.stringify(nextRoles));
    fd.set("pins", JSON.stringify(nextPins));
    fd.set("origins", JSON.stringify(nextOrigins));
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
    const nextOrigins = markUserSet ? { ...origins, [role]: SAMPLED_ORIGIN } : origins;
    commit(setRoleColor(roles, role, normalizeHex(value)), nextPins, nextOrigins);
    setHexDraft(normalizeHex(value));
    setPendingHex(null);
  }

  function fixTextContrast() {
    const ratio = textOnBackgroundContrast(roles);
    if (pending || ratio == null || ratio >= 4.5) return;
    const rows = COLOR_ROLES.flatMap((role) => roles[role] ? [{
      role, hex: roles[role]!, origin: origins[role], ...pins[role],
    }] : []);
    const best = textContrastFix(roles.background!, rows);
    const nextPins = { ...pins };
    delete nextPins.text;
    if (best.pinX != null && best.pinY != null) nextPins.text = { pinX: best.pinX, pinY: best.pinY };
    commit(setRoleColor(roles, "text", normalizeHex(best.hex)), nextPins, { ...origins, text: FIX_ORIGIN });
    if (open === "text") setHexDraft(normalizeHex(best.hex));
  }

  function onChip(color: NamedColor) {
    const empty = COLOR_ROLES.find((role) => !roles[role]);
    setPendingHex(color.hex);
    openRole(empty ?? open ?? "primary");
    setHexDraft(color.hex);
  }

  function resetSamplePreview(role = open) {
    setLoupe(null);
    onPinDrag?.(null);
    if (role) setHexDraft(roles[role] ?? "");
  }

  function samplePointer(clientX: number, clientY: number, commitSample: boolean, start?: PinDragPoint | null, role = open) {
    const img = photoRef?.current;
    if (!role || !img || !crop) return null;
    const rect = img.getBoundingClientRect();
    const mapped = pointerOnCoverBox(clientX, clientY, rect, crop);
    if (!mapped) {
      if (commitSample) resetSamplePreview(role);
      return null;
    }
    const geometry = {
      width: img.naturalWidth, height: img.naturalHeight,
      boxWidth: rect.width, boxHeight: rect.height, crop,
    };
    if (commitSample) onPinDrag?.(null);
    try {
      if (commitSample && (isNoopPinDrag(start, mapped, geometry) || isNoopPinSample(pins[role], mapped, geometry))) {
        resetSamplePreview(role);
        return mapped;
      }
      const sample = commitSample
        ? sampleImagePixel(img, mapped.nx, mapped.ny)
        : sampleImageAverage(img, mapped.nx, mapped.ny, 8);
      setLoupe({ x: mapped.x, y: mapped.y, hex: sample.hex });
      if (commitSample) {
        const nextPins = { ...pins, [role]: { pinX: sample.pinX, pinY: sample.pinY } };
        onPromoteRole?.(role, { pinX: sample.pinX, pinY: sample.pinY, hex: sample.hex });
        applyHex(role, sample.hex, nextPins, true);
      } else {
        onPinDrag?.({ role, x: mapped.x, y: mapped.y });
        setHexDraft(sample.hex);
      }
    } catch {
      // keep the previous color if the image cannot be sampled
      if (commitSample) resetSamplePreview(role);
    }
    return mapped;
  }

  // Loupe updates render the parent on every move. Keep the native listeners and
  // their active pointer intact, while sampling with the latest role/crop/state.
  const pointerHandlers = useRef({ samplePointer, resetSamplePreview, openRole, open });
  useEffect(() => {
    pointerHandlers.current = { samplePointer, resetSamplePreview, openRole, open };
  });

  useEffect(() => {
    const img = photoRef?.current;
    if (!open || !img) return;
    const previousPointerEvents = img.style.pointerEvents;
    const previousTouchAction = img.style.touchAction;
    img.style.pointerEvents = "auto";
    img.style.touchAction = "none";
    return () => {
      img.style.pointerEvents = previousPointerEvents;
      img.style.touchAction = previousTouchAction;
    };
  }, [open, photoRef]);

  useEffect(() => {
    const img = photoRef?.current;
    if (!img) return;
    // Disc-centered hit areas are siblings of the image. Delegate on the photo but
    // capture on the image, preserving the same release-point sampling stream.
    const surface = img.closest<HTMLElement>("[data-photo-fold]") ?? img;
    let active: { pointerId: number; role: ColorRole; start: PinDragPoint; lastGood: PointerPoint } | null = null;
    const preventNativeDrag = (e: DragEvent) => e.preventDefault();
    const onDown = (e: PointerEvent) => {
      if (active || !e.isPrimary || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const hitRole = target?.closest?.<HTMLElement>("[data-pin-hit]")?.dataset.pinHit;
      const role = COLOR_ROLES.find((r) => r === hitRole) ??
        (target === img ? pointerHandlers.current.open : null);
      if (!role) return; // Back and other photo controls retain their events.
      if (role !== pointerHandlers.current.open) pointerHandlers.current.openRole(role);
      const start = pointerHandlers.current.samplePointer(e.clientX, e.clientY, false, null, role);
      if (!start) return;
      // Images are natively draggable in Chromium: without this, dragstart
      // cancels our pointer stream and reports (0, 0) instead of a drop.
      e.preventDefault();
      active = { pointerId: e.pointerId, role, start, lastGood: { clientX: e.clientX, clientY: e.clientY } };
      img.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!active || active.pointerId !== e.pointerId) return;
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      active.lastGood = { clientX: e.clientX, clientY: e.clientY };
      pointerHandlers.current.samplePointer(e.clientX, e.clientY, false, null, active.role);
    };
    const onUp = (e: PointerEvent) => {
      if (!active || active.pointerId !== e.pointerId) return;
      const drag = active;
      active = null;
      const point = resolvePinDropPoint(e, drag.lastGood);
      if (point) pointerHandlers.current.samplePointer(point.clientX, point.clientY, true, drag.start, drag.role);
      else pointerHandlers.current.resetSamplePreview(drag.role);
      if (img.hasPointerCapture(e.pointerId)) img.releasePointerCapture(e.pointerId);
    };
    const onLostCapture = (e: PointerEvent) => {
      if (!active || active.pointerId !== e.pointerId) return;
      const role = active.role;
      active = null;
      pointerHandlers.current.resetSamplePreview(role);
    };
    img.addEventListener("dragstart", preventNativeDrag);
    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onUp);
    surface.addEventListener("lostpointercapture", onLostCapture);
    return () => {
      if (active && img.hasPointerCapture(active.pointerId)) img.releasePointerCapture(active.pointerId);
      active = null;
      img.removeEventListener("dragstart", preventNativeDrag);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
      surface.removeEventListener("lostpointercapture", onLostCapture);
    };
  }, [photoRef]);

  useEffect(() => {
    if (!simulateLoupe || !open || !crop || !photoBox || !imageSize) return;
    const hex = roles[open] ?? "#000000";
    const pin = pins[open];
    if (!pin) {
      setLoupe({ x: photoBox.w / 2, y: photoBox.h / 2, hex });
      return;
    }
    const surface = photoRef?.current?.closest<HTMLElement>("[data-photo-fold]");
    const safeTop = surface?.querySelector<HTMLElement>("[data-safe-top]");
    const safeTopPx = safeTop ? Number.parseFloat(getComputedStyle(safeTop).paddingTop) || 0 : 0;
    const avoid = surface?.querySelector("[data-photo-back]") ? photoBackZone(safeTopPx) : null;
    const mappedPins = COLOR_ROLES.flatMap(role => {
      const sample = pins[role];
      if (!roles[role] || !sample) return [];
      const mapped = mapCoverPinRaw(sample.pinX, sample.pinY, imageSize.width, imageSize.height,
        photoBox.w, photoBox.h, crop);
      return mapped ? [{ role, x: mapped.left * photoBox.w, y: mapped.top * photoBox.h }] : [];
    });
    const placement = layoutPins(mappedPins, photoBox, avoid)[mappedPins.findIndex(p => p.role === open)];
    if (placement) setLoupe({ ...placement.disc, hex });
  }, [simulateLoupe, open, crop, photoBox?.w, photoBox?.h, imageSize?.width, imageSize?.height, photoRef, pins, roles]);

  const reduced = prefersReducedMotion();
  const { background: editorBackground, ink: editorInk } = showContrast
    ? pageChromeColors(roles)
    : { background: pageBackground, ink: pageInk };
  const chipAnim = reduced
    ? `${MOTION_CSS.reducedMs}ms ${MOTION_CSS.easeEnter}`
    : `${MOTION_CSS.enterMs}ms ${MOTION_CSS.easeEnter}`;

  return (
    <section>
      <div data-band-stack data-revealed={bandsRevealed ? "true" : "false"}>
        <PaletteBands
          roles={roles}
          size={size}
          pageBackground={editorBackground}
          pageInk={editorInk}
          onPick={openRole}
          onFocusRole={onFocusRole}
          bandRefs={bandRefs}
        />
      </div>
      {children}
      {showContrast ? <ContrastAa roles={roles} onFix={fixTextContrast} pending={pending} /> : null}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 px-5">
          {chips.map((color) => {
            const noun = chipNoun(color.label, color.hex);
            return (
              <div
                key={color.hex}
                data-named-chip
                data-chip-source={color.source ?? "region"}
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
          style={showContrast ? kitWearStyle(roles) : undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            // The sticky photo is an editing surface outside the sheet portal.
            const target = event.detail.originalEvent.target as HTMLElement | null;
            if (target === photoRef?.current || target?.closest?.("[data-pin-hit], [data-photo-back]")) event.preventDefault();
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
              style={{ outlineColor: editorInk }}
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
                      borderColor: editorInk,
                      backgroundColor: selected ? editorInk : "transparent",
                      color: selected ? editorBackground : editorInk,
                      outlineColor: editorInk,
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
                      commit(moveRole(roles, open, role), { ...pins, [open]: pins[role], [role]: pins[open] }, {
                        ...origins, [open]: origins[role], [role]: origins[open],
                      });
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
                  const nextPins = { ...pins };
                  delete nextPins[open];
                  commit(setRoleColor(roles, open, null), nextPins);
                  setOpenRole(null);
                }}
              >
                Clear this role
              </button>
            ) : null}
            {history.length > 0 ? (
              <button
                type="button"
                className="min-h-11 text-base"
                disabled={pending}
                onClick={() => {
                  const previous = history[history.length - 1]!;
                  setHistory((prev) => prev.slice(0, -1));
                  commit(previous.roles, previous.pins, previous.origins, false);
                  if (open) setHexDraft(previous.roles[open] ?? "");
                  setPendingHex(null);
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
