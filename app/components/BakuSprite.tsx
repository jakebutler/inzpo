"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  BAKU_CROSSFADE_MS,
  BAKU_SHADOW_CLIP_PCT,
  bakuCanTint,
  bakuDensity,
  bakuV6BandsSrc,
  bakuV6ColorSrc,
  bakuV6PoseSrc,
  type BakuDensity,
} from "@/lib/baku-v6";
import { tintRoles, tintSpriteWithBands } from "@/lib/baku-tint";
import { kitForPose, kitHasPalette, type MascotKit, type MascotPose } from "@/lib/mascot";
import { prefersReducedMotion } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function composeTint(
  pose: MascotPose,
  density: BakuDensity,
  colors: Array<string | null>,
): Promise<string> {
  const spriteImg = await loadImage(bakuV6PoseSrc(pose, density));
  const bandImg = await loadImage(bakuV6BandsSrc(pose, density));
  const canvas = document.createElement("canvas");
  canvas.width = spriteImg.naturalWidth;
  canvas.height = spriteImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  ctx.drawImage(spriteImg, 0, 0);
  const sprite = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bandImg, 0, 0, canvas.width, canvas.height);
  const bands = ctx.getImageData(0, 0, canvas.width, canvas.height);
  tintSpriteWithBands(sprite.data, bands.data, canvas.width, canvas.height, 4, 4, colors);
  ctx.putImageData(sprite, 0, 0);
  return canvas.toDataURL("image/png");
}

function useDensity(): BakuDensity {
  const [density, setDensity] = useState<BakuDensity>(1);
  useEffect(() => {
    const read = () => setDensity(bakuDensity(window.devicePixelRatio || 1));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return density;
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
  const density = useDensity();
  const canTint = bakuCanTint(pose) && kitHasPalette(colors);
  const paletteKey = COLOR_ROLES.map((role) => colors[role] ?? "").join(",");
  const baseSrc = canTint
    ? bakuV6PoseSrc(pose, density)
    : bakuCanTint(pose)
      ? bakuV6ColorSrc(pose, density)
      : bakuV6PoseSrc(pose, density);
  const squashRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLImageElement>(null);
  const [pngFailed, setPngFailed] = useState(false);
  const [tinted, setTinted] = useState<string | null>(null);
  const [tintFailed, setTintFailed] = useState(false);

  useEffect(() => {
    setPngFailed(false);
    setTinted(null);
    setTintFailed(false);
  }, [pose, density, canTint]);

  useEffect(() => {
    if (!canTint || pngFailed) {
      setTinted(null);
      return;
    }
    let alive = true;
    const roles = tintRoles(colors, revealedCount);
    void composeTint(pose, density, roles)
      .then((url) => {
        if (!alive) return;
        setTinted(url);
        setTintFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setTinted(null);
        setTintFailed(true);
      });
    return () => {
      alive = false;
    };
    // paletteKey stands in for kit colors so we do not re-tint every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canTint, pngFailed, pose, density, paletteKey, revealedCount]);

  useGSAP(
    () => {
      const el = bodyRef.current ?? squashRef.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(el, { opacity: 0.35 }, { opacity: 1, duration: BAKU_CROSSFADE_MS / 1000, ease: "power2.out" });
    },
    { dependencies: [pose, density, baseSrc] },
  );

  const src = tintFailed ? bakuV6ColorSrc(pose, density) : tinted ?? baseSrc;
  const showPng = !pngFailed;
  const failPng = () => {
    if (canTint && src !== bakuV6ColorSrc(pose, density)) {
      setTintFailed(true);
      return;
    }
    setPngFailed(true);
  };
  const shadowClip = `inset(${100 - BAKU_SHADOW_CLIP_PCT}% 0 0 0)`;
  const bodyClip = `inset(0 0 ${BAKU_SHADOW_CLIP_PCT}% 0)`;
  // Flip the imgs, not a wrapper: a transformed ancestor isolates mix-blend-mode
  // and the pale oval then reads as a white smudge on navy bands.
  const flip = faceText && showPng ? "scaleX(-1)" : undefined;

  return (
    <div
      data-baku-sprite={showPng ? "png" : "svg"}
      data-baku-v6={showPng ? "1" : "0"}
      data-baku-tinted={tinted ? "1" : "0"}
      data-baku-density={density}
      style={{
        width: size,
        height: size,
      }}
    >
      <div ref={squashRef} className="relative h-full w-full">
        {showPng ? (
          <>
            {/* Blend the wrapper, not the img: WebKit skips mix-blend-mode on transformed replaced elements. */}
            <div
              data-baku-shadow
              className="pointer-events-none absolute inset-0"
              style={{ mixBlendMode: "multiply" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                width={size}
                height={size}
                className="block h-full w-full"
                style={{
                  clipPath: shadowClip,
                  transform: flip,
                  transformOrigin: "50% 100%",
                }}
                draggable={false}
                onError={failPng}
              />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={bodyRef}
              src={src}
              alt=""
              width={size}
              height={size}
              data-baku-body
              className="relative block h-full w-full"
              style={{ clipPath: bodyClip, transform: flip, transformOrigin: "50% 100%" }}
              draggable={false}
              onError={failPng}
            />
          </>
        ) : (
          fallback
        )}
      </div>
    </div>
  );
}
