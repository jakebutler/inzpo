"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  BAKU_CREAM,
  emptyKit,
  kitForPose,
  kitHasPalette,
  stripeCssVars,
  type MascotKit,
  type MascotPose,
} from "@/lib/mascot";
import { BAKU_TINT_ENABLED, type BakuSrcPose } from "@/lib/baku-v6";
import {
  BAKU_BODY_D,
  BAKU_SEAM_DS,
  BAKU_STRIPE_DS,
  BAKU_TRUNK_D,
  BAKU_VIEWBOX,
} from "@/lib/mascot-svg";
import type { MascotRiveRuntime } from "./load-mascot-rive";
import { BakuSprite } from "./BakuSprite";
import "./mascot.css";

const STRIPE_CLASS = COLOR_ROLES.map((role) => `baku-stripe baku-stripe-${role}`);

export type MascotProps = {
  pose: MascotPose | BakuSrcPose;
  kit?: MascotKit | null;
  size?: number;
  /** Set true once Snap can be tapped. Loads the Rive runtime then; SVG stays up until it arrives. */
  snapReady?: boolean;
  className?: string;
  /** How many token-order stripes have landed. Null means all filled roles. */
  revealedCount?: number | null;
  /** Flip so left-facing v6 art looks at the brief/copy. */
  faceText?: boolean;
  /** Band/page hex under the sprite, used to bake the ground-shadow multiply. */
  ground?: string;
  /** Skip tinting in the opt-in path. Always uses the colour PNG when tinting is off. */
  forcePoseAsset?: boolean;
};

export function Mascot({
  pose,
  kit,
  size = 48,
  snapReady = false,
  className,
  revealedCount = null,
  faceText = false,
  ground,
  forcePoseAsset = false,
}: MascotProps) {
  const rawId = useId().replace(/:/g, "");
  const clipId = `baku-clip-${rawId}`;
  const colors = BAKU_TINT_ENABLED ? kitForPose(pose, kit) : emptyKit();
  const [rive, setRive] = useState<MascotRiveRuntime | null>(null);

  useEffect(() => {
    if (!BAKU_TINT_ENABLED || !snapReady) return;
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

  if (BAKU_TINT_ENABLED && rive && pose !== "404" && pose !== "error-photo") {
    return rive.render({ pose, kit: colors, size });
  }

  const vars = stripeCssVars(colors);
  const style = {
    width: size,
    height: size,
    ...vars,
  } as CSSProperties;

  const svg = (
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
              {BAKU_STRIPE_DS.map((d, i) => {
                const role = COLOR_ROLES[i];
                if (!role || !colors[role]) return null;
                if (revealedCount != null && i >= revealedCount) return null;
                return <path key={STRIPE_CLASS[i]} className={STRIPE_CLASS[i]} d={d} />;
              })}
              {BAKU_SEAM_DS.map((d, i) => {
                const above = COLOR_ROLES[i];
                const below = COLOR_ROLES[i + 1];
                if (!above || !below || !colors[above] || !colors[below]) return null;
                return <path key={d} className="baku-seam" d={d} />;
              })}
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
  );

  return (
    <div
      className={["baku", className].filter(Boolean).join(" ")}
      data-pose={pose}
      data-seams={kitHasPalette(colors) ? "on" : "off"}
      style={style}
      aria-hidden="true"
    >
      <BakuSprite
        pose={pose}
        kit={kit}
        size={size}
        revealedCount={revealedCount}
        faceText={faceText}
        ground={ground}
        forcePoseAsset={forcePoseAsset}
        fallback={svg}
      />
    </div>
  );
}
