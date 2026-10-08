"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TokenEditor } from "./TokenEditor";
import { BriefSlot, type BriefSlotStatus } from "./BriefSlot";
import { kitFromColors } from "@/lib/mascot";
import { MOTION_CSS } from "@/lib/motion";
import { pinNumbers } from "@/lib/tokens";
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
}: {
  itemId: string;
  title: string | null;
  imageSrc: string | null;
  width: number;
  height: number;
  colors: ColorRow[];
  tileSrc: string | null;
  saved?: boolean;
}) {
  const router = useRouter();
  const kit = kitFromColors(colors);
  const numbers = useMemo(() => pinNumbers(colors), [colors]);
  const kicked = useRef(false);
  const [brief, setBrief] = useState<{ status: BriefSlotStatus; text: string | null; namedHexes: string[] }>({
    status: "pending",
    text: null,
    namedHexes: [],
  });
  const [moving, setMoving] = useState(false);
  const aspect = width / Math.max(1, height);
  const capped = aspect < 4 / 5;

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const res = await fetch(`/api/briefs/${itemId}`, { cache: "no-store" });
      if (!res.ok || !alive) return;
      const job = (await res.json()) as { status: BriefSlotStatus; text: string | null; namedHexes?: string[] };
      setBrief({ status: job.status, text: job.text, namedHexes: job.namedHexes ?? [] });
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
  }, [itemId]);

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
    <div className="mx-auto max-w-[390px] pb-28">
      {imageSrc ? (
        <div
          className="relative w-full overflow-hidden bg-neutral-900"
          style={{ aspectRatio: capped ? "4 / 5" : `${width} / ${height}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt={title ?? "Photo"} className="absolute inset-0 h-full w-full object-cover" />
          {colors.map((c) =>
            c.role && c.pinX != null && c.pinY != null && numbers[c.role] != null ? (
              <span
                key={`${c.role}-${c.position}`}
                className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                style={{ left: `${c.pinX * 100}%`, top: `${c.pinY * 100}%` }}
              >
                {numbers[c.role]}
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      <div className="px-4 pt-4">
        <TokenEditor itemId={itemId} imageSrc={imageSrc} colors={colors} namedHexes={brief.namedHexes} />
        <BriefSlot
          status={brief.status}
          kit={kit}
          note={brief.text}
          onRetry={() => {
            kicked.current = true;
            void fetch(`/api/briefs/${itemId}`, { method: "POST" }).then(async (res) => {
              if (!res.ok) return;
              const job = (await res.json()) as { status: BriefSlotStatus; text: string | null; namedHexes?: string[] };
              setBrief({ status: job.status, text: job.text, namedHexes: job.namedHexes ?? [] });
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
              className="mt-2 min-h-11 text-sm text-muted-foreground"
              style={{ transitionDuration: `${MOTION_CSS.tapMs}ms` }}
            >
              {moving ? "Moving…" : "Move crop"}
            </button>
          </section>
        ) : null}
        {saved ? (
          <p className="mt-4 text-sm" role="status" style={{ transitionDuration: `${MOTION_CSS.enterMs}ms` }}>
            Saved. Baku is full.
          </p>
        ) : null}
      </div>
    </div>
  );
}
