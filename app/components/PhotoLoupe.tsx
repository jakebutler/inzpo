import { INK, LOUPE_OFFSET_PX, LOUPE_PX, LOUPE_ZOOM, PAPER } from "@/lib/brand";

export function PhotoLoupe({
  imageSrc,
  boxW,
  boxH,
  x,
  y,
  hex,
  pointer = false,
}: {
  imageSrc: string;
  boxW: number;
  boxH: number;
  x: number;
  y: number;
  hex: string;
  pointer?: boolean;
}) {
  if (!imageSrc || boxW <= 0 || boxH <= 0) return null;
  const loupeTop = y - LOUPE_OFFSET_PX;
  return (
    <>
      {pointer ? (
        <span
          data-qa-pointer
          aria-hidden
          className="pointer-events-none absolute z-[61] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: x, top: y, backgroundColor: "rgba(28,27,25,.35)" }}
        />
      ) : null}
      <span
        data-loupe
        aria-hidden
        className="pointer-events-none absolute z-[62] overflow-hidden rounded-full"
        style={{
          width: LOUPE_PX,
          height: LOUPE_PX,
          left: x,
          top: loupeTop,
          transform: "translate(-50%, -100%)",
          boxShadow: `0 0 0 1.5px ${INK}, 0 1px 2px rgba(0,0,0,.25)`,
          backgroundColor: PAPER,
          backgroundImage: `url(${imageSrc})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${boxW * LOUPE_ZOOM}px ${boxH * LOUPE_ZOOM}px`,
          backgroundPosition: `${-(x * LOUPE_ZOOM - LOUPE_PX / 2)}px ${-(y * LOUPE_ZOOM - LOUPE_PX / 2)}px`,
        }}
      >
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ backgroundColor: INK }} />
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ backgroundColor: INK }} />
      </span>
      <span
        data-loupe-hex
        className="pointer-events-none absolute z-[62] -translate-x-1/2 font-mono text-sm tabular-nums"
        style={{
          left: x,
          top: loupeTop + 4,
          color: INK,
          backgroundColor: PAPER,
          padding: "2px 6px",
        }}
      >
        {hex}
      </span>
    </>
  );
}
