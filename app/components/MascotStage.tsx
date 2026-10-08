"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MASCOT_CHEW_COPY_MS,
  MASCOT_SIZE_PX,
  MASCOT_WAIT_MS,
  copyForMoment,
  poseForMoment,
  waitBeforeShow,
  type MascotKit,
  type MascotMoment,
} from "@/lib/mascot";
import { Mascot } from "./Mascot";

export function MascotStage({
  moment,
  kit,
  snapReady = false,
  size = MASCOT_SIZE_PX,
  onRetry,
  onShown,
  className,
}: {
  moment: MascotMoment;
  kit?: MascotKit | null;
  snapReady?: boolean;
  size?: number;
  onRetry?: () => void;
  onShown?: () => void;
  className?: string;
}) {
  const pose = poseForMoment(moment);
  const delayed = waitBeforeShow(moment);
  const [shown, setShown] = useState(!delayed);
  const [chewElapsedMs, setChewElapsedMs] = useState(0);
  const shownOnce = useRef(false);
  const router = useRouter();

  useEffect(() => {
    shownOnce.current = false;
    setChewElapsedMs(0);
    if (!delayed) {
      setShown(true);
      return;
    }
    setShown(false);
    const timer = window.setTimeout(() => setShown(true), MASCOT_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [delayed, moment]);

  useEffect(() => {
    if (!shown || shownOnce.current) return;
    shownOnce.current = true;
    onShown?.();
  }, [shown, onShown]);

  useEffect(() => {
    if (!shown || pose !== "chewing") {
      setChewElapsedMs(0);
      return;
    }
    const timer = window.setTimeout(() => setChewElapsedMs(MASCOT_CHEW_COPY_MS), MASCOT_CHEW_COPY_MS);
    return () => window.clearTimeout(timer);
  }, [shown, pose, moment]);

  const copy = copyForMoment(moment, chewElapsedMs);
  const retry = onRetry ?? (() => router.refresh());

  return (
    <div className={["flex items-start gap-3", className].filter(Boolean).join(" ")} style={{ minHeight: size }}>
      <div style={{ width: size, height: size, flex: "0 0 auto" }} className={shown ? "opacity-100" : "opacity-0"}>
        <Mascot pose={pose} kit={kit} size={size} snapReady={snapReady} />
      </div>
      {shown ? (
        <div className="min-w-0 pt-1">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {copy}
          </p>
          {moment === "error-brief" ? (
            <button
              type="button"
              onClick={retry}
              className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm text-foreground"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
