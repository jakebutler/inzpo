"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { COLOR_ROLES } from "@/lib/db/schema";
import {
  BAKU_CROSSFADE_MS,
  bakuCanTint,
  bakuDensity,
  bakuV6BandsSrc,
  bakuV6ColorSrc,
  bakuV6ShadeSrc,
  type BakuDensity,
  type BakuSrcPose,
} from "@/lib/baku-v6";
import { tintRoles, tintSpriteWithBands } from "@/lib/baku-tint";
import { kitForPose, type MascotKit } from "@/lib/mascot";
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
  pose: BakuSrcPose,
  density: BakuDensity,
  colors: Array<string | null>,
): Promise<string> {
  const [spriteImg, bandImg, shadeImg] = await Promise.all([
    loadImage(bakuV6ColorSrc(pose, density)),
    loadImage(bakuV6BandsSrc(pose, density)),
    loadImage(bakuV6ShadeSrc(pose, density)),
  ]);
  if ([bandImg, shadeImg].some((img) => img.naturalWidth !== spriteImg.naturalWidth || img.naturalHeight !== spriteImg.naturalHeight)) {
    throw new Error("Baku tint assets must match the colour sprite dimensions");
  }
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(shadeImg, 0, 0);
  const shade = ctx.getImageData(0, 0, canvas.width, canvas.height);
  tintSpriteWithBands(sprite.data, bands.data, canvas.width, canvas.height, 4, 4, colors, shade.data, 4);
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
  forcePoseAsset = false,
  fallback,
}: {
  pose: BakuSrcPose;
  kit?: MascotKit | null;
  size: number;
  revealedCount?: number | null;
  faceText?: boolean;
  ground?: string;
  forcePoseAsset?: boolean;
  fallback: ReactNode;
}) {
  const colors = kitForPose(pose as "idle" | "chewing" | "success" | "empty" | "error-brief" | "error-unreadable" | "404" | "error-photo", kit);
  const density = bakuDensity(useDensity() * Math.max(1, size / 48));
  const canTint = bakuCanTint(pose) && !forcePoseAsset;
  const paletteKey = COLOR_ROLES.map((role) => colors[role] ?? "").join(",");
  const tintKey = `${pose}:${density}:${canTint}:${paletteKey}`;
  const baseSrc = bakuV6ColorSrc(pose, density);
  const squashRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLImageElement>(null);
  const [pngFailed, setPngFailed] = useState(false);
  const [tinted, setTinted] = useState<{ key: string; src: string } | null>(null);
  const [tintFailed, setTintFailed] = useState<string | null>(null);

  useEffect(() => {
    setPngFailed(false);
    setTinted(null);
    setTintFailed(null);
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
        setTinted({ key: tintKey, src: url });
        setTintFailed(null);
      })
      .catch(() => {
        if (!alive) return;
        setTinted(null);
        setTintFailed(tintKey);
      });
    return () => {
      alive = false;
    };
    // paletteKey stands in for kit colors so we do not re-tint every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canTint, pngFailed, pose, density, paletteKey, tintKey, revealedCount]);

  useGSAP(
    () => {
      const el = bodyRef.current ?? squashRef.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(el, { opacity: 0.35 }, { opacity: 1, duration: BAKU_CROSSFADE_MS / 1000, ease: "power2.out" });
    },
    { dependencies: [pose, density, baseSrc] },
  );

  const tintedSrc = tinted?.key === tintKey ? tinted.src : null;
  const failedTint = tintFailed === tintKey;
  const src = failedTint ? baseSrc : tintedSrc ?? baseSrc;
  // While tint assets load, the SVG already has oatmeal empties on its first frame.
  const showPng = !pngFailed && (!canTint || tintedSrc != null || failedTint);

  const failPng = () => {
    if (canTint && src !== bakuV6ColorSrc(pose, density)) {
      setTintFailed(tintKey);
      return;
    }
    setPngFailed(true);
  };
  // Flip the complete sprite, including its baked black-alpha ground shadow.
  const flip = faceText && showPng ? "scaleX(-1)" : undefined;

  return (
    <div
      data-baku-sprite={showPng ? "png" : "svg"}
      data-baku-v6={showPng ? "1" : "0"}
      data-baku-tinted={tintedSrc && !failedTint ? "1" : "0"}
      data-baku-shadow-baked={showPng ? "1" : "0"}
      data-baku-density={density}
      style={{
        width: size,
        height: size,
      }}
    >
      <div ref={squashRef} className="relative h-full w-full">
        {showPng ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={bodyRef}
              src={src}
              alt=""
              width={size}
              height={size}
              data-baku-body
              className="relative block h-full w-full"
              style={{ transform: flip, transformOrigin: "50% 100%" }}
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
