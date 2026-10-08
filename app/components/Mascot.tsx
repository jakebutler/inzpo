"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  BAKU_CREAM,
  kitForPose,
  kitHasPalette,
  stripeCssVars,
  type MascotKit,
  type MascotPose,
} from "@/lib/mascot";
import {
  BAKU_BODY_D,
  BAKU_SEAM_DS,
  BAKU_STRIPE_DS,
  BAKU_TRUNK_D,
  BAKU_VIEWBOX,
} from "@/lib/mascot-svg";
import type { MascotRiveRuntime } from "./load-mascot-rive";
import "./mascot.css";

const STRIPE_CLASS = COLOR_ROLES.map((role) => `baku-stripe baku-stripe-${role}`);

export type MascotProps = {
  pose: MascotPose;
  kit?: MascotKit | null;
  size?: number;
  /** Set true once Snap can be tapped. Loads the Rive runtime then; SVG stays up until it arrives. */
  snapReady?: boolean;
  className?: string;
};

export function Mascot({ pose, kit, size = 48, snapReady = false, className }: MascotProps) {
  const rawId = useId().replace(/:/g, "");
  const clipId = `baku-clip-${rawId}`;
  const colors = kitForPose(pose, kit);
  const [rive, setRive] = useState<MascotRiveRuntime | null>(null);

  useEffect(() => {
    if (!snapReady) return;
    let alive = true;
    void import("./load-mascot-rive").then(async ({ loadMascotRive }) => {
      const runtime = await loadMascotRive();
      if (!alive || !runtime) return;
      setRive(runtime);
    });
    return () => {
      alive = false;
    };
  }, [snapReady]);

  if (rive) {
    return rive.render({ pose, kit: colors, size });
  }

  const vars = stripeCssVars(colors);
  const style = {
    width: size,
    height: size,
    ...vars,
  } as CSSProperties;

  return (
    <div
      className={["baku", className].filter(Boolean).join(" ")}
      data-pose={pose}
      data-seams={kitHasPalette(colors) ? "on" : "off"}
      style={style}
      aria-hidden="true"
    >
      <div className="baku-hop">
        <svg viewBox={BAKU_VIEWBOX} width={size} height={size} focusable="false">
          <defs>
            <clipPath id={clipId}>
              <path d={BAKU_BODY_D} />
            </clipPath>
          </defs>
          <g className="baku-body">
            <path className="baku-coat" d={BAKU_BODY_D} />
            <g clipPath={`url(#${clipId})`}>
              {BAKU_STRIPE_DS.map((d, i) => (
                <path key={STRIPE_CLASS[i]} className={STRIPE_CLASS[i]} d={d} />
              ))}
              {BAKU_SEAM_DS.map((d) => (
                <path key={d} className="baku-seam" d={d} />
              ))}
            </g>
          </g>
          <g className="baku-eyes">
            <ellipse cx="24.5" cy="19.5" rx="3.15" ry="3.55" fill="#2a2420" />
            <ellipse cx="39.5" cy="19.5" rx="3.15" ry="3.55" fill="#2a2420" />
            <circle cx="25.6" cy="18.4" r="0.95" fill={BAKU_CREAM} />
            <circle cx="40.6" cy="18.4" r="0.95" fill={BAKU_CREAM} />
          </g>
          <g className="baku-trunk">
            <path d={BAKU_TRUNK_D} fill="var(--baku-cream)" />
            <ellipse cx="32" cy="55.4" rx="2.3" ry="1.35" fill="#c9b89a" />
          </g>
        </svg>
      </div>
    </div>
  );
}
