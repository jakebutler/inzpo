"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { TokenEditor, type LoupeView } from "./TokenEditor";
import { BriefSlot, type BriefSlotStatus } from "./BriefSlot";
import { ContrastAa } from "./ContrastAa";
import { PhotoLoupe } from "./PhotoLoupe";
import { PhotoBackButton } from "./PhotoBackButton";
import { kitFromColors } from "@/lib/mascot";
import { MOTION, MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { rolesFromColors } from "@/lib/tokens";
import { coverWindowForPins, mapCoverPin, objectPositionCss } from "@/lib/cover-pin";
import { parseNamedColors, type NamedColor } from "@/lib/brief-copy";
import { kitDisplayName } from "@/lib/kit-name";
import { SAVE_BAR_PAD } from "@/lib/layout";
import { kitWearStyle } from "@/lib/kit-wear";
import { claimRevealPlay, type RevealMode } from "@/lib/reveal";
import {
  BAND_H_RESULT,
  BAND_STAGGER_S,
  INK,
  PAPER,
  PHOTO_FOLD_CSS,
  PHOTO_FOLD_PX,
  PIN_HAIRLINE_S,
  PIN_LEADER_X,
  pinDiscStyle,
} from "@/lib/brand";

gsap.registerPlugin(useGSAP);

type ColorRow = {
  hex: string;
  role?: ColorRole | null;
  pinX?: number | null;
  pinY?: number | null;
  position: number;
};

const TILE_PX = 256;

export function KitResult({
  itemId,
  title,
  imageSrc,
  width,
  height,
  colors,
  tileSrc,
  saved,
  backHref = "/",
  showBack = true,
  preview,
}: {
  itemId: string;
  title: string | null;
  imageSrc: string | null;
  width: number;
  height: number;
  colors: ColorRow[];
  tileSrc: string | null;
  saved?: boolean;
  backHref?: string;
  showBack?: boolean;
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
  const kit = kitFromColors(colors);
  const roles = rolesFromColors(colors);
  const kicked = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState({ w: width, h: PHOTO_FOLD_PX });
  const [stripeCount, setStripeCount] = useState(preview?.reveal === "play" ? 0 : 6);
  const [linePulse, setLinePulse] = useState(false);
  const [focusedRole, setFocusedRole] = useState<ColorRole | null>(null);
  const [editOpen, setEditOpen] = useState(preview?.openRole != null);
  const [loupe, setLoupe] = useState<LoupeView | null>(null);
  const [revealTick, setRevealTick] = useState(0);
  const [brief, setBrief] = useState<{
    status: BriefSlotStatus;
    text: string | null;
    namedColors: NamedColor[];
    stub: boolean;
  }>({
    status: preview?.status ?? "pending",
    text: preview?.text ?? null,
    namedColors: preview?.namedColors ?? [],
    stub: preview?.stub === true,
  });
  const [moving, setMoving] = useState(false);
  const reduced = prefersReducedMotion();
  const pageBg = roles.background ?? PAPER;
  const pageInk = roles.text ?? INK;
  const displayTitle = kitDisplayName({
    title,
    briefText: brief.text,
    namedColors: brief.namedColors,
    pending: brief.status === "pending" || brief.stub,
  });

  const crop = useMemo(() => {
    const pins = colors
      .filter((c) => c.pinX != null && c.pinY != null)
      .map((c) => ({ x: c.pinX as number, y: c.pinY as number }));
    return coverWindowForPins(width, height, box.w, box.h, pins);
  }, [colors, width, height, box.w, box.h]);

  useEffect(() => {
    const el = photoRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [imageSrc]);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    const tick = async () => {
      const res = await fetch(`/api/briefs/${itemId}`, { cache: "no-store" });
      if (!res.ok || !alive) return;
      const job = (await res.json()) as {
        status: BriefSlotStatus;
        text: string | null;
        namedHexes?: string[];
        namedColors?: unknown;
        stub?: boolean;
      };
      setBrief({
        status: job.status,
        text: job.text,
        namedColors: parseNamedColors(job.namedColors, job.namedHexes ?? []),
        stub: job.stub === true,
      });
      if (job.status === "pending") {
        if (!kicked.current) {
          kicked.current = true;
          void fetch(`/api/briefs/${itemId}`, { method: "POST" });
        }
        window.setTimeout(() => void tick(), 2500);
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [itemId, preview]);

  useGSAP(
    () => {
      const root = stageRef.current;
      if (!root) return;
      const bands = root.querySelectorAll<HTMLElement>("[data-band-stack] .inzpo-band");
      const mode: RevealMode = preview?.reveal ?? "play";
      const land = () => {
        gsap.set(bands, { y: 0 });
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
      if (reduced || mode === "landed") {
        land();
        return;
      }
      const stack = BAND_H_RESULT * COLOR_ROLES.length;
      if (mode === "mid") {
        gsap.set(bands, { y: (i) => (i < 3 ? 0 : stack * 0.35) });
        setStripeCount(3);
        setLinePulse(false);
        return;
      }
      if (!claimRevealPlay(itemId)) {
        land();
        return;
      }
      gsap.set(bands, { y: stack });
      setLinePulse(true);
      const tl = gsap.timeline({
        defaults: { duration: MOTION.enter.duration, ease: MOTION.enter.ease },
      });
      bands.forEach((band, i) => {
        tl.to(band, { y: 0 }, i * BAND_STAGGER_S);
        tl.add(() => setStripeCount(i + 1), i * BAND_STAGGER_S);
      });
      return () => {
        tl.kill();
      };
    },
    { scope: stageRef, dependencies: [itemId, preview?.reveal, reduced, revealTick] },
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
    { dependencies: [linePulse, reduced, box.w, box.h] },
  );

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
  const hideBrief = brief.stub && !saved;

  return (
    <div ref={stageRef} className="relative w-full" style={wearStyle} data-kit-wear>
      {imageSrc ? (
        <div
          ref={photoRef}
          className={editOpen ? "sticky top-0 z-[60] w-full" : "relative w-full"}
          data-photo-fold
          style={{ height: PHOTO_FOLD_CSS }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt={displayTitle}
              className="h-full w-full object-cover"
              style={{ filter: "none", objectPosition, touchAction: editOpen ? "none" : undefined }}
              crossOrigin="anonymous"
            />
          </div>
          {showBack && !saved ? <PhotoBackButton href={backHref} /> : null}
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            {colors.map((c) => {
              if (!c.role || c.pinX == null || c.pinY == null) return null;
              const mapped = mapCoverPin(c.pinX, c.pinY, width, height, box.w, box.h, crop);
              if (!mapped) return null;
              return (
                <span
                  key={`${c.role}-${c.position}`}
                  data-pin={c.role}
                  className="absolute rounded-full"
                  style={{
                    ...pinDiscStyle(c.hex),
                    left: `${mapped.left * 100}%`,
                    top: `${mapped.top * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
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
      {imageSrc ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 w-full overflow-visible"
          style={{ height: box.h + BAND_H_RESULT * COLOR_ROLES.length }}
          aria-hidden
        >
          {COLOR_ROLES.map((role, i) => {
            const row = colors.find((c) => c.role === role);
            if (!row || row.pinX == null || row.pinY == null) return null;
            const mapped = mapCoverPin(row.pinX, row.pinY, width, height, box.w, box.h, crop);
            if (!mapped) return null;
            const x1 = mapped.left * box.w;
            const y1 = mapped.top * box.h;
            const x2 = PIN_LEADER_X;
            const y2 = box.h + (i + 0.5) * BAND_H_RESULT;
            const d = Math.hypot(x2 - x1, y2 - y1);
            const visible = linePulse || focusedRole === role;
            return (
              <g key={role} opacity={visible ? 1 : 0}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={INK}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  data-pin-line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
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
      ) : null}

      <TokenEditor
        itemId={itemId}
        imageSrc={imageSrc}
        colors={colors}
        namedColors={brief.namedColors}
        size="result"
        pageBackground={pageBg}
        pageInk={pageInk}
        initialOpen={preview?.openRole ?? null}
        onFocusRole={setFocusedRole}
        onOpenChange={(role) => setEditOpen(role !== null)}
        photoRef={imgRef}
        photoBox={box}
        crop={crop}
        imageSize={{ width, height }}
        simulateLoupe={preview?.loupe === true}
        onLoupe={setLoupe}
      >
        <span data-stripe-count={stripeCount} className="sr-only">
          {stripeCount} stripes
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
            kicked.current = true;
            void fetch(`/api/briefs/${itemId}`, { method: "POST" }).then(async (res) => {
              if (!res.ok) return;
              const job = (await res.json()) as {
                status: BriefSlotStatus;
                text: string | null;
                namedHexes?: string[];
                namedColors?: unknown;
                stub?: boolean;
              };
              setBrief({
                status: job.status,
                text: job.text,
                namedColors: parseNamedColors(job.namedColors, job.namedHexes ?? []),
                stub: job.stub === true,
              });
            });
          }}
        />
        <ContrastAa roles={roles} />
      </TokenEditor>
      {tileSrc ? (
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
  );
}
