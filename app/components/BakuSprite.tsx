"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  BAKU_CROSSFADE_MS,
  bakuV6BandMaskSrc,
  bakuV6BandsSrc,
  bakuV6PoseSrc,
  bakuV6PoseSrcSet,
} from "@/lib/baku-v6";
import { kitForPose, type MascotKit, type MascotPose } from "@/lib/mascot";
import { prefersReducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

const pngReady = new Map<MascotPose, boolean>();

function probe(src: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export function BakuSprite({
  pose,
  kit,
  size,
  revealedCount = null,
  faceText = false,
  fallback,
}: {
  pose: MascotPose;
  kit?: MascotKit | null;
  size: number;
  revealedCount?: number | null;
  faceText?: boolean;
  fallback: ReactNode;
}) {
  const colors = kitForPose(pose, kit);
  const squashRef = useRef<HTMLDivElement>(null);
  const [png, setPng] = useState(() => pngReady.get(pose) === true);

  useEffect(() => {
    let alive = true;
    const cached = pngReady.get(pose);
    if (cached === true) {
      setPng(true);
      return;
    }
    if (cached === false) {
      setPng(false);
      return;
    }
    void probe(bakuV6PoseSrc(pose, 1)).then((ok) => {
      pngReady.set(pose, ok);
      if (!alive) return;
      setPng(ok);
    });
    return () => {
      alive = false;
    };
  }, [pose]);

  useGSAP(
    () => {
      const el = squashRef.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el,
        { opacity: 0.35, scaleY: 0.92, scaleX: 1.06 },
        { opacity: 1, scaleY: 1, scaleX: 1, duration: BAKU_CROSSFADE_MS / 1000, ease: "power2.out" },
      );
    },
    { dependencies: [pose, png] },
  );

  return (
    <div
      data-baku-sprite={png ? "png" : "svg"}
      data-baku-v6={png ? "1" : "0"}
      style={{
        width: size,
        height: size,
        transform: faceText && png ? "scaleX(-1)" : undefined,
        transformOrigin: "center",
      }}
    >
      <div ref={squashRef} className="h-full w-full" style={{ transformOrigin: "50% 100%" }}>
        {png ? (
          <div className="relative h-full w-full" style={{ transition: `opacity ${BAKU_CROSSFADE_MS}ms ease` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bakuV6PoseSrc(pose, 1)}
              srcSet={bakuV6PoseSrcSet(pose)}
              alt=""
              className="absolute inset-0 h-full w-full"
              draggable={false}
            />
            {COLOR_ROLES.map((role, i) => {
              const hex = colors[role];
              if (!hex) return null;
              if (revealedCount != null && i >= revealedCount) return null;
              return (
                <span
                  key={role}
                  data-baku-band={role}
                  className="absolute inset-0"
                  style={
                    {
                      backgroundColor: hex,
                      mixBlendMode: "multiply",
                      WebkitMaskImage: `url(${bakuV6BandMaskSrc(pose, role)}), url(${bakuV6BandsSrc(pose)})`,
                      maskImage: `url(${bakuV6BandMaskSrc(pose, role)}), url(${bakuV6BandsSrc(pose)})`,
                      maskMode: "luminance",
                      WebkitMaskSize: "100% 100%",
                      maskSize: "100% 100%",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}
