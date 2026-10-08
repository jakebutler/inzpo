"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { TokenEditor } from "./TokenEditor";
import { BriefSlot, type BriefSlotStatus } from "./BriefSlot";
import { kitFromColors } from "@/lib/mascot";
import { MOTION, MOTION_CSS, prefersReducedMotion } from "@/lib/motion";
import { COLOR_ROLES, type ColorRole } from "@/lib/db/schema";
import { pinNumbers, rolesFromColors } from "@/lib/tokens";
import { mapCoverPin } from "@/lib/cover-pin";
import { parseNamedColors, type NamedColor } from "@/lib/brief-copy";
import { PHOTO_MAX_SVH, SAVE_BAR_PAD } from "@/lib/layout";
import { BAND_H_RESULT, BAND_STAGGER_S, INK, PAPER, PIN_HAIRLINE_S, PIN_SIZE } from "@/lib/brand";
import { saveControlColors } from "@/lib/contrast";

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
  preview?: {
    namedColors?: NamedColor[];
    status?: BriefSlotStatus;
    text?: string | null;
    stub?: boolean;
    reveal?: "play" | "landed" | "mid";
    openRole?: ColorRole | null;
  };
}) {
  const router = useRouter();
  const kit = kitFromColors(colors);
  const roles = rolesFromColors(colors);
  const numbers = useMemo(() => pinNumbers(colors), [colors]);
  const kicked = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: width, h: height });
  const [stripeCount, setStripeCount] = useState(preview?.reveal === "play" ? 0 : 6);
  const [hairlines, setHairlines] = useState(false);
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
  const save = saveControlColors(roles.accent, roles.background);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prev = {
      bg: root.style.getPropertyValue("--background"),
      fg: root.style.getPropertyValue("--foreground"),
      primary: root.style.getPropertyValue("--primary"),
      primaryFg: root.style.getPropertyValue("--primary-foreground"),
      bodyBg: body.style.backgroundColor,
      bodyColor: body.style.color,
      bodyT: body.style.transition,
    };
    root.style.setProperty("--background", pageBg);
    root.style.setProperty("--foreground", pageInk);
    root.style.setProperty("--primary", save.fill);
    root.style.setProperty("--primary-foreground", save.ink);
    body.style.transition = `background-color ${MOTION_CSS.smallMs}ms ease-in-out, color ${MOTION_CSS.smallMs}ms ease-in-out`;
    body.style.backgroundColor = pageBg;
    body.style.color = pageInk;
    return () => {
      root.style.setProperty("--background", prev.bg);
      root.style.setProperty("--foreground", prev.fg);
      root.style.setProperty("--primary", prev.primary);
      root.style.setProperty("--primary-foreground", prev.primaryFg);
      body.style.backgroundColor = prev.bodyBg;
      body.style.color = prev.bodyColor;
      body.style.transition = prev.bodyT;
    };
  }, [pageBg, pageInk, save.fill, save.ink]);

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
      if (bands.length === 0) return;
      const mode = preview?.reveal ?? "play";
      if (reduced || mode === "landed") {
        gsap.set(bands, { y: 0 });
        setStripeCount(6);
        setHairlines(false);
        return;
      }
      const stack = BAND_H_RESULT * COLOR_ROLES.length;
      if (mode === "mid") {
        gsap.set(bands, { y: (i) => (i < 3 ? 0 : stack * 0.35) });
        setStripeCount(3);
        setHairlines(false);
        return;
      }
      gsap.set(bands, { y: stack });
      const tl = gsap.timeline({
        defaults: { duration: MOTION.enter.duration, ease: MOTION.enter.ease },
        onComplete: () => setHairlines(true),
      });
      bands.forEach((band, i) => {
        tl.to(band, { y: 0 }, i * BAND_STAGGER_S);
        tl.add(() => setStripeCount(i + 1), i * BAND_STAGGER_S);
      });
    },
    { scope: stageRef, dependencies: [imageSrc, colors.length, preview?.reveal, reduced] },
  );

  useGSAP(
    () => {
      if (!hairlines || reduced) return;
      const lines = stageRef.current?.querySelectorAll("[data-pin-line]");
      if (!lines || lines.length === 0) return;
      gsap.fromTo(
        lines,
        { strokeDashoffset: 120, opacity: 1 },
        {
          strokeDashoffset: 0,
          duration: PIN_HAIRLINE_S,
          ease: MOTION.enter.ease,
          stagger: 0.04,
          onComplete: () => {
            gsap.to(lines, { opacity: 0, duration: MOTION.leave.duration, ease: MOTION.leave.ease, delay: 0.08 });
          },
        },
      );
    },
    { dependencies: [hairlines, reduced, box.w, box.h] },
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

  const pinRing = roles.text ?? INK;
  const wearStyle = {
    backgroundColor: pageBg,
    color: pageInk,
    transitionDuration: `${MOTION_CSS.smallMs}ms`,
    transitionProperty: "background-color, color",
    transitionTimingFunction: "ease-in-out",
    ["--background" as string]: pageBg,
    ["--foreground" as string]: pageInk,
    ["--primary" as string]: save.fill,
    ["--primary-foreground" as string]: save.ink,
    paddingBottom: SAVE_BAR_PAD,
  };

  return (
    <div ref={stageRef} className="relative w-full" style={wearStyle} data-kit-wear>
      {imageSrc ? (
        <div
          ref={photoRef}
          className="relative w-full overflow-hidden"
          data-photo-fold
          style={{ height: PHOTO_MAX_SVH }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={title ?? "Photo"} className="h-full w-full object-cover" style={{ filter: "none" }} />
          {colors.map((c) => {
            if (!c.role || c.pinX == null || c.pinY == null) return null;
            const mapped = mapCoverPin(c.pinX, c.pinY, width, height, box.w, box.h);
            if (!mapped) return null;
            return (
              <span
                key={`${c.role}-${c.position}`}
                data-pin={c.role}
                className="absolute rounded-full"
                style={{
                  width: PIN_SIZE,
                  height: PIN_SIZE,
                  left: `${mapped.left * 100}%`,
                  top: `${mapped.top * 100}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: c.hex,
                  boxShadow: `0 0 0 2px ${pinRing}`,
                }}
              />
            );
          })}
        </div>
      ) : null}
      {hairlines && imageSrc ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 w-full overflow-visible"
          style={{ height: box.h + BAND_H_RESULT * COLOR_ROLES.length }}
          aria-hidden
        >
          {COLOR_ROLES.map((role, i) => {
            const row = colors.find((c) => c.role === role);
            if (!row || row.pinX == null || row.pinY == null) return null;
            const mapped = mapCoverPin(row.pinX, row.pinY, width, height, box.w, box.h);
            if (!mapped) return null;
            const x1 = mapped.left * box.w;
            const y1 = mapped.top * box.h;
            const x2 = 24;
            const y2 = box.h + (i + 0.5) * BAND_H_RESULT;
            const d = Math.hypot(x2 - x1, y2 - y1);
            return (
              <line
                key={role}
                data-pin-line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={pinRing}
                strokeWidth="1"
                strokeDasharray={d}
                strokeDashoffset={d}
              />
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
        initialOpen={preview?.openRole ?? null}
      />
      <span data-stripe-count={stripeCount} className="sr-only">
        {stripeCount} stripes
      </span>
      {brief.stub && brief.status === "ready" ? (
        <p className="mt-2 px-4 text-base">Brief is a stub — no DO_INFERENCE_API_KEY.</p>
      ) : null}
      <div className="px-4">
        <BriefSlot
          status={brief.status}
          kit={kit}
          note={brief.text}
          stripeReveal={stripeCount}
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
        {tileSrc ? (
          <section className="mt-6">
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
        {saved ? (
          <p
            data-saved-note
            className="mt-4 text-base"
            role="status"
            style={{ transitionDuration: `${MOTION_CSS.enterMs}ms` }}
          >
            Saved. Baku is full.
          </p>
        ) : null}
      </div>
    </div>
  );
}
