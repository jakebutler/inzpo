"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { TokenEditor, type LoupeView } from "./TokenEditor";
import { BriefSlot, type BriefSlotStatus } from "./BriefSlot";
import { useKitChrome } from "./KitChrome";
import { PhotoLoupe } from "./PhotoLoupe";
import { PhotoBackButton } from "./PhotoBackButton";
import { kitFromColors } from "@/lib/mascot";
import { MOTION, MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { rolesFromColors } from "@/lib/tokens";
import { coverWindowForPins, coverPinPlacement, objectPositionCss, photoBackZone, PIN_HIT_SIZE_PX } from "@/lib/cover-pin";
import { parseNamedColors, type NamedColor } from "@/lib/brief-copy";
import { useKitDisplayName } from "./useKitDisplayName";
import { SavedKitHeader } from "./SavedKitHeader";
import { isRecentPendingBrief, type BriefState } from "@/lib/brief-state";
import { SAVE_BAR_PAD } from "@/lib/layout";
import { kitWearStyle } from "@/lib/kit-wear";
import { claimRevealPlay, type RevealMode } from "@/lib/reveal";
import { sampledColors } from "@/lib/derived-roles";
import { pageChromeColors } from "@/lib/contrast";
import { preferredHairline, type BandBox, type Hairline } from "@/lib/hairlines";
import {
  BAND_H_RESULT,
  BAND_STAGGER_S,
  INK,
  PAPER,
  PHOTO_FOLD_CSS,
  PHOTO_FOLD_PX,
  PIN_HAIRLINE_S,
  pinDiscStyle,
} from "@/lib/brand";

gsap.registerPlugin(useGSAP);

type ColorRow = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  position: number;
  derivedFrom?: ColorRole | null;
  origin?: string | null;
};

const TILE_PX = 256;

function pinsForCrop(colors: ColorRow[]) {
  return colors
    .filter((c) => c.role && c.pinX != null && c.pinY != null)
    .map((c) => ({ x: c.pinX as number, y: c.pinY as number }));
}

function readSafeTop(el: HTMLElement | null): number {
  if (!el) return 0;
  const probe = el.querySelector("[data-safe-top]");
  if (!(probe instanceof HTMLElement)) return 0;
  const pad = Number.parseFloat(getComputedStyle(probe).paddingTop);
  return Number.isFinite(pad) ? pad : 0;
}

function bandBoxFor(
  band: HTMLElement | null,
  stage: HTMLElement,
  stackEl: HTMLElement | null,
): BandBox | null {
  if (!band) return null;
  const br = band.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  const clip = stackEl?.getBoundingClientRect() ?? br;
  const opacity = Number.parseFloat(getComputedStyle(band).opacity);
  const intersects =
    br.bottom > clip.top + 0.5 &&
    br.top < clip.bottom - 0.5 &&
    br.right > clip.left + 0.5 &&
    br.left < clip.right - 0.5;
  return {
    left: br.left - sr.left,
    top: br.top - sr.top,
    right: br.right - sr.left,
    bottom: br.bottom - sr.top,
    visible: opacity > 0.04 && intersects,
  };
}

export function KitResult({
  itemId,
  title,
  imageSrc,
  width,
  height,
  colors,
  tileSrc,
  placeholderSrc,
  saved,
  backHref = "/",
  showBack = true,
  preview,
  initialBrief,
}: {
  itemId: string;
  title: string | null;
  imageSrc: string | null;
  width: number;
  height: number;
  colors: ColorRow[];
  tileSrc: string | null;
  placeholderSrc?: string | null;
  saved?: boolean;
  backHref?: string;
  showBack?: boolean;
  initialBrief?: BriefState | null;
  preview?: {
    namedColors?: NamedColor[];
    status?: BriefSlotStatus;
    text?: string | null;
    stub?: boolean;
    reveal?: RevealMode;
    openRole?: ColorRole | null;
    loupe?: boolean;
  };
}) {
  const router = useRouter();
  const chrome = useKitChrome();
  const [editedColors, setEditedColors] = useState<ColorRow[] | null>(null);
  useEffect(() => { setEditedColors(null); }, [colors]);
  const displayColors = useMemo(
    () => sampledColors(editedColors ?? colors),
    [colors, editedColors],
  );
  const kit = kitFromColors(displayColors);
  const roles = rolesFromColors(displayColors);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const bandRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [box, setBox] = useState({ w: width, h: PHOTO_FOLD_PX });
  const [safeTop, setSafeTop] = useState(0);
  const [dragPin, setDragPin] = useState<{ role: ColorRole; x: number; y: number } | null>(null);
  const [stripeCount, setStripeCount] = useState(
    preview?.reveal === "play" || preview?.reveal === "hold" ? 0 : 6,
  );
  const [linePulse, setLinePulse] = useState(false);
  const [focusedRole, setFocusedRole] = useState<ColorRole | null>(null);
  const [editOpen, setEditOpen] = useState(preview?.openRole != null);
  const [editingPins, setEditingPins] = useState<Array<{ x: number; y: number }> | null>(
    () => preview?.openRole ? pinsForCrop(displayColors) : null,
  );
  const [loupe, setLoupe] = useState<LoupeView | null>(null);
  const [revealTick, setRevealTick] = useState(0);
  const [bandsRevealed, setBandsRevealed] = useState(
    preview?.reveal === "landed" || preview?.reveal === "mid",
  );
  const [leaders, setLeaders] = useState<Array<Hairline | null>>([]);
  const [brief, setBrief] = useState<{
    status: BriefSlotStatus;
    text: string | null;
    namedColors: NamedColor[];
    stub: boolean;
    updatedAt: number;
    title?: string | null;
  }>({
    status: preview?.status ?? initialBrief?.status ?? "pending",
    text: preview?.text ?? null,
    namedColors: preview?.namedColors ?? [],
    stub: preview?.stub ?? initialBrief?.stub ?? false,
    updatedAt: preview ? Date.now() : initialBrief?.updatedAt ?? 0,
  });
  const [moving, setMoving] = useState(false);
  const [photoReady, setPhotoReady] = useState(!imageSrc);
  const reduced = prefersReducedMotion();
  const { background: pageBg, ink: pageInk } = pageChromeColors(roles);
  const primaryHex = COLOR_ROLES.map((role) => roles[role]).find(Boolean);
  const displayTitle = useKitDisplayName({ title: brief.title ?? title, primaryHex, brief });
  const crop = useMemo(() => {
    // Keep the photo under the user's pointer fixed throughout the edit session.
    // Recompute for a resized box, but do not pan in response to a sampled pin.
    const pins = editingPins ?? pinsForCrop(displayColors);
    return coverWindowForPins(width, height, box.w, box.h, pins);
  }, [displayColors, editingPins, width, height, box.w, box.h]);
  const backZone = showBack && !saved && backHref ? photoBackZone(safeTop) : null;
  const drawnPins = displayColors.flatMap((color) => {
    if (!color.role || color.pinX == null || color.pinY == null) return [];
    const placed = coverPinPlacement(color.pinX, color.pinY, width, height, box.w, box.h, crop, backZone);
    if (!placed) return [];
    const placement = dragPin?.role === color.role
      ? { disc: dragPin, hit: dragPin, displaced: false, offcrop: false, tick: null }
      : placed;
    return [{ color, ...placement }];
  });
  // The reveal ticker keeps its callback for the life of the photo. Read the
  // latest disc geometry so resize, safe-area changes and drags cannot stale it.
  const hairlineGeometry = useRef({ pins: drawnPins, photoBottom: box.h });
  useEffect(() => {
    hairlineGeometry.current = { pins: drawnPins, photoBottom: box.h };
  });

  useEffect(() => {
    const el = photoRef.current;
    if (!el) return;
    const measure = () => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
      setSafeTop(readSafeTop(el));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [imageSrc]);

  useEffect(() => {
    if (!imageSrc) {
      setPhotoReady(true);
      return;
    }
    setPhotoReady(false);
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setPhotoReady(true);
    };
    const node = imgRef.current;
    const warmup = new Image();
    warmup.decoding = "async";
    warmup.src = imageSrc;
    const decodeTarget = node && node.currentSrc ? node : warmup;
    const wait = decodeTarget.decode ? decodeTarget.decode() : Promise.resolve();
    void wait.then(markReady).catch(markReady);
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    let recoveryRequested = false;
    const tick = async () => {
      const res = await fetch(`/api/briefs/${itemId}`, { cache: "no-store" });
      if (!res.ok || !alive) return;
      const job = (await res.json()) as {
        title?: string | null;
        status: BriefSlotStatus;
        text: string | null;
        namedHexes?: string[];
        namedColors?: unknown;
        stub?: boolean;
        updatedAt?: number;
      };
      setBrief({
        status: job.status,
        text: job.text,
        namedColors: parseNamedColors(job.namedColors, job.namedHexes ?? []),
        stub: job.stub === true,
        updatedAt: job.updatedAt ?? 0,
        title: job.title,
      });
      if (job.title && job.title !== title) router.refresh();
      if (job.status === "pending") {
        // Recovery only: if the capture-time run never finished, ask once.
        // The server ignores this for any brief that is no longer pending.
        if (!recoveryRequested && !isRecentPendingBrief({ ...job, updatedAt: job.updatedAt ?? 0 })) {
          recoveryRequested = true;
          void fetch(`/api/briefs/${itemId}`, { method: "POST" });
        }
        window.setTimeout(() => void tick(), 2500);
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [itemId, preview, router, title]);

  function syncHairlines() {
    const stage = stageRef.current;
    if (!stage) {
      setLeaders([]);
      return;
    }
    const stackEl = stage.querySelector<HTMLElement>("[data-band-stack]");
    const { pins, photoBottom } = hairlineGeometry.current;
    const lines: Array<Hairline | null> = [];
    for (let i = 0; i < COLOR_ROLES.length; i++) {
      const role = COLOR_ROLES[i]!;
      const pin = pins.find(({ color }) => color.role === role);
      if (!pin) {
        lines.push(null);
        continue;
      }
      const band = bandBoxFor(bandRefs.current[i] ?? null, stage, stackEl);
      if (!band) {
        lines.push(null);
        continue;
      }
      // Leaders originate at the visible disc, including during drag, and end
      // at the photo bottom. The clipped SVG never draws through band rows.
      lines.push(preferredHairline(pin.disc.x, pin.disc.y, band, photoBottom));
    }
    setLeaders(lines);
  }

  useGSAP(
    () => {
      const root = stageRef.current;
      if (!root) return;
      const stackEl = root.querySelector<HTMLElement>("[data-band-stack]");
      const bands = root.querySelectorAll<HTMLElement>("[data-band-stack] .inzpo-band");
      const mode: RevealMode = preview?.reveal ?? "play";
      const revealNow = () => {
        stackEl?.setAttribute("data-revealed", "true");
        setBandsRevealed(true);
      };
      const land = () => {
        gsap.set(bands, { y: 0, opacity: 1 });
        revealNow();
        setStripeCount(6);
        setLinePulse(false);
      };
      if (bands.length === 0) {
        if (mode === "play") {
          const id = window.requestAnimationFrame(() => setRevealTick((n) => n + 1));
          return () => window.cancelAnimationFrame(id);
        }
        return;
      }
      if (mode === "hold") {
        gsap.set(bands, { y: 8, opacity: 0 });
        setStripeCount(0);
        setLinePulse(false);
        setLeaders([]);
        return;
      }
      if (mode === "landed") {
        land();
        gsap.ticker.add(syncHairlines);
        return () => gsap.ticker.remove(syncHairlines);
      }
      if (reduced) {
        gsap.set(bands, { y: 0, opacity: 0 });
        revealNow();
        gsap.to(bands, { opacity: 1, duration: MOTION.reduced.duration, ease: MOTION.reduced.ease });
        setStripeCount(6);
        setLinePulse(false);
        gsap.ticker.add(syncHairlines);
        return () => gsap.ticker.remove(syncHairlines);
      }
      const stack = BAND_H_RESULT * COLOR_ROLES.length;
      if (mode === "mid") {
        gsap.set(bands, { y: (i) => (i < 3 ? 0 : stack * 0.35), opacity: 1 });
        revealNow();
        setStripeCount(3);
        setLinePulse(false);
        gsap.ticker.add(syncHairlines);
        return () => gsap.ticker.remove(syncHairlines);
      }
      if (mode === "play" && !photoReady) {
        gsap.set(bands, { y: 8, opacity: 0 });
        return;
      }
      if (!claimRevealPlay(itemId)) {
        land();
        gsap.ticker.add(syncHairlines);
        return () => gsap.ticker.remove(syncHairlines);
      }
      gsap.set(bands, { y: 8, opacity: 0 });
      const tl = gsap.timeline({
        defaults: { duration: MOTION.enter.duration, ease: MOTION.enter.ease },
        onStart: () => {
          stackEl?.setAttribute("data-revealed", "true");
          setLinePulse(true);
        },
        onComplete: () => {
          setBandsRevealed(true);
        },
        onUpdate: syncHairlines,
      });
      bands.forEach((band, i) => {
        tl.to(band, { y: 0, opacity: 1 }, i * BAND_STAGGER_S);
        tl.add(() => setStripeCount(i + 1), i * BAND_STAGGER_S);
      });
      gsap.ticker.add(syncHairlines);
      return () => {
        tl.kill();
        gsap.ticker.remove(syncHairlines);
      };
    },
    { scope: stageRef, dependencies: [itemId, preview?.reveal, reduced, revealTick, photoReady] },
  );

  useGSAP(
    () => {
      if (!linePulse || reduced) return;
      const lines = stageRef.current?.querySelectorAll("[data-pin-line]");
      if (!lines || lines.length === 0) return;
      gsap.fromTo(
        lines,
        { strokeDashoffset: 160, opacity: 1 },
        {
          strokeDashoffset: 0,
          duration: PIN_HAIRLINE_S,
          ease: MOTION.enter.ease,
          stagger: 0.04,
          onComplete: () => {
            gsap.to(lines, { opacity: 0, duration: MOTION.leave.duration, ease: MOTION.leave.ease, delay: 0.08 });
            setLinePulse(false);
          },
        },
      );
    },
    { dependencies: [linePulse, reduced, box.w, box.h, leaders.length] },
  );

  useEffect(() => {
    if (focusedRole) syncHairlines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedRole, box.w, box.h, displayColors, safeTop, dragPin]);

  async function moveCrop() {
    setMoving(true);
    try {
      await fetch(`/api/texture/${itemId}`, { method: "POST" });
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  const wearStyle = {
    ...kitWearStyle(roles),
    transitionDuration: `${MOTION_CSS.smallMs}ms`,
    transitionProperty: "background-color, color",
    transitionTimingFunction: "ease-in-out",
    paddingBottom: SAVE_BAR_PAD,
  };
  const objectPosition = crop ? objectPositionCss(crop) : "50% 50%";
  const hideBrief = false;

  return (
    <>
    <div ref={stageRef} className="relative w-full" style={wearStyle} data-kit-wear data-save-content>
      {saved ? <SavedKitHeader title={brief.title ?? title} primaryHex={primaryHex} brief={brief} backHref={backHref} itemId={itemId} /> : null}
      {imageSrc ? (
        <div
          ref={photoRef}
          className={editOpen ? "sticky top-0 z-[60] w-full" : "relative w-full"}
          data-photo-fold
          style={{ height: PHOTO_FOLD_CSS, overflow: "visible" }}
        >
          <span data-safe-top className="pointer-events-none absolute" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }} />
          <div className="absolute inset-0 overflow-hidden">
            {placeholderSrc || tileSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={placeholderSrc || tileSrc || ""}
                alt=""
                aria-hidden
                data-photo-lqip
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  objectPosition,
                  filter: "blur(16px)",
                  transform: "scale(1.08)",
                  opacity: photoReady ? 0 : 1,
                }}
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt={displayTitle}
              className="relative h-full w-full object-cover"
              style={{
                filter: "none",
                objectPosition,
                touchAction: editOpen ? "none" : undefined,
                opacity: photoReady ? 1 : 0,
              }}
              crossOrigin="anonymous"
              fetchPriority="high"
              decoding="async"
              draggable={false}
            />
          </div>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ overflow: "hidden" }}
            aria-hidden
          >
            {drawnPins.map(({ color, tick }) => tick ? (
              <g key={`tick-${color.role}`}>
                <line {...tick} stroke={INK} strokeWidth="3" strokeLinecap="round" />
                <line data-pin-tick={color.role} {...tick} stroke={PAPER} strokeWidth="1" strokeLinecap="round" />
              </g>
            ) : null)}
            {COLOR_ROLES.map((role, i) => {
              const line = leaders[i];
              const row = displayColors.find((c) => c.role === role);
              if (!line || !row) return null;
              const d = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
              const visible = linePulse || focusedRole === role;
              return (
                <g key={role} opacity={visible ? 1 : 0}>
                  <line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={INK}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <line
                    data-pin-line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={PAPER}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeDasharray={d}
                    strokeDashoffset={linePulse ? d : 0}
                  />
                </g>
              );
            })}
          </svg>
          {showBack && !saved ? <PhotoBackButton href={backHref} /> : null}
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            {drawnPins.map(({ color: c, disc, hit, displaced, offcrop }) => {
              return (
                <Fragment key={`${c.role}-${c.position}`}>
                  <span
                    data-pin={c.role}
                    data-pin-displaced={displaced ? "true" : undefined}
                    data-pin-offcrop={offcrop ? "true" : undefined}
                    data-pin-x={c.pinX}
                    data-pin-y={c.pinY}
                    data-origin={c.origin ?? "extracted"}
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      ...pinDiscStyle(c.hex),
                      left: disc.x,
                      top: disc.y,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  <span
                    data-pin-hit={c.role}
                    aria-hidden
                    className="pointer-events-auto absolute rounded-full"
                    style={{
                      width: PIN_HIT_SIZE_PX,
                      height: PIN_HIT_SIZE_PX,
                      left: hit.x,
                      top: hit.y,
                      transform: "translate(-50%, -50%)",
                      touchAction: "none",
                    }}
                  />
                </Fragment>
              );
            })}
            {loupe ? (
              <PhotoLoupe
                imageSrc={imageSrc}
                boxW={box.w}
                boxH={box.h}
                x={loupe.x}
                y={loupe.y}
                hex={loupe.hex}
                pointer={preview?.loupe === true}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <TokenEditor
        itemId={itemId}
        imageSrc={imageSrc}
        colors={displayColors}
        namedColors={brief.namedColors}
        size="result"
        showContrast
        pageBackground={pageBg}
        pageInk={pageInk}
        initialOpen={preview?.openRole ?? null}
        onFocusRole={setFocusedRole}
        onOpenChange={(role) => {
          setEditingPins((prev) => role ? prev ?? pinsForCrop(displayColors) : null);
          setEditOpen(role !== null);
        }}
        photoRef={imgRef}
        photoBox={box}
        crop={crop}
        imageSize={{ width, height }}
        simulateLoupe={preview?.loupe === true}
        onLoupe={setLoupe}
        onPinDrag={setDragPin}
        onColorsChange={(next) => {
          const rows = next.map((row, position) => ({ ...row, position }));
          setEditedColors(rows);
          chrome?.setRoles(rolesFromColors(rows));
        }}
        bandRefs={bandRefs}
        bandsRevealed={bandsRevealed}
      >
        <span data-stripe-count={COLOR_ROLES.slice(0, stripeCount).filter((role) => roles[role]).length} className="sr-only">
          {COLOR_ROLES.slice(0, stripeCount).filter((role) => roles[role]).length} stripes
        </span>
        <BriefSlot
          status={brief.status}
          kit={kit}
          note={brief.stub ? null : brief.text}
          hidden={hideBrief}
          saved={saved}
          stripeReveal={stripeCount}
          pageBackground={pageBg}
          pageInk={pageInk}
          onRetry={() => {
            setBrief((prev) => ({ ...prev, status: "pending", text: null, stub: false, updatedAt: Date.now() }));
            void fetch(`/api/briefs/${itemId}?retry=1`, { method: "POST" }).then(async (res) => {
              if (!res.ok) {
                setBrief((prev) => ({ ...prev, status: "failed" }));
                return;
              }
              const job = (await res.json()) as {
                title?: string | null;
                status: BriefSlotStatus;
                text: string | null;
                namedHexes?: string[];
                namedColors?: unknown;
                stub?: boolean;
                updatedAt?: number;
              };
              setBrief({
                status: job.status,
                text: job.text,
                namedColors: parseNamedColors(job.namedColors, job.namedHexes ?? []),
                stub: job.stub === true,
                updatedAt: job.updatedAt ?? 0,
                title: job.title,
              });
              if (job.title && job.title !== title) router.refresh();
            }).catch(() => setBrief((prev) => ({ ...prev, status: "failed" })));
          }}
        />
      </TokenEditor>
      {tileSrc && brief.status !== "pending" ? (
        <section className="mt-5 px-5">
          <div
            className="h-40 overflow-hidden"
            style={{
              backgroundImage: `url(${tileSrc})`,
              backgroundRepeat: "repeat",
              backgroundSize: `${TILE_PX}px ${TILE_PX}px`,
            }}
            aria-label="Texture tile"
          />
          <button
            type="button"
            onClick={() => void moveCrop()}
            disabled={moving}
            className="mt-2 min-h-11 text-base"
            style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
          >
            {moving ? "Moving…" : "Move crop"}
          </button>
        </section>
      ) : null}
    </div>
    </>
  );
}
