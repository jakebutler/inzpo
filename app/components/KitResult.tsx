"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TokenEditor } from "./TokenEditor";
import { BriefSlot, type BriefSlotStatus } from "./BriefSlot";
import { kitFromColors } from "@/lib/mascot";
import { MOTION_CSS } from "@/lib/motion";
import { pinNumbers } from "@/lib/tokens";
import { mapCoverPin } from "@/lib/cover-pin";
import { parseNamedColors, type NamedColor } from "@/lib/brief-copy";
import { PHOTO_MAX_SVH, SAVE_BAR_PAD } from "@/lib/layout";
import type { ColorRole } from "@/lib/db/schema";

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
  };
}) {
  const router = useRouter();
  const kit = kitFromColors(colors);
  const numbers = useMemo(() => pinNumbers(colors), [colors]);
  const kicked = useRef(false);
  const photoRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: width, h: height });
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

  async function moveCrop() {
    setMoving(true);
    try {
      await fetch(`/api/texture/${itemId}`, { method: "POST" });
      router.refresh();
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[390px]" style={{ paddingBottom: SAVE_BAR_PAD }}>
      {imageSrc ? (
        <div
          ref={photoRef}
          className="relative w-full overflow-hidden bg-neutral-900"
          data-photo-fold
          style={{ height: PHOTO_MAX_SVH }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={title ?? "Photo"} className="h-full w-full object-cover" />
          {colors.map((c) => {
            if (!c.role || c.pinX == null || c.pinY == null || numbers[c.role] == null) return null;
            const mapped = mapCoverPin(c.pinX, c.pinY, width, height, box.w, box.h);
            if (!mapped) return null;
            return (
              <span
                key={`${c.role}-${c.position}`}
                className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-[11px] text-white"
                style={{ left: `${mapped.left * 100}%`, top: `${mapped.top * 100}%` }}
              >
                {numbers[c.role]}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="px-4 pt-4">
        <TokenEditor itemId={itemId} imageSrc={imageSrc} colors={colors} namedColors={brief.namedColors} />
        {brief.stub && brief.status === "ready" ? (
          <p className="mt-2 text-base text-muted-foreground">Brief is a stub — no DO_INFERENCE_API_KEY.</p>
        ) : null}
        <BriefSlot
          status={brief.status}
          kit={kit}
          note={brief.text}
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
              className="h-40 overflow-hidden rounded-xl border border-border"
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
              className="mt-2 min-h-11 text-base text-muted-foreground"
              style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
            >
              {moving ? "Moving…" : "Move crop"}
            </button>
          </section>
        ) : null}
        {saved ? (
          <p className="mt-4 text-base" role="status" style={{ transitionDuration: `${MOTION_CSS.enterMs}ms` }}>
            Saved. Baku is full.
          </p>
        ) : null}
      </div>
    </div>
  );
}
