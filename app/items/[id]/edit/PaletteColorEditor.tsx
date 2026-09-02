"use client";

import { useRef, useState } from "react";
import { updatePaletteColorsAction } from "@/app/actions/palettes";
import { COLOR_FAMILIES, hexToFamily, hexToHsv, hexToCmyk, cmykToHex, hsvToHex, isHexColor, normalizeHex } from "@/lib/colors";

const FAMILY_PRESET: Record<string, string> = {
  red: "#e02020",
  orange: "#ff8800",
  yellow: "#ffee00",
  "cream/beige": "#f5f0d8",
  brown: "#7a4a2b",
  gold: "#d4af37",
  green: "#2e9e44",
  teal: "#20b2aa",
  blue: "#1e6fd9",
  purple: "#7a3ff2",
  pink: "#ff8ac2",
  black: "#111111",
  white: "#ffffff",
  gray: "#8a8a8a",
};

export function PaletteColorEditor({ itemId, initialColors }: { itemId: string; initialColors: string[] }) {
  const [colors, setColors] = useState<string[]>(initialColors.length > 0 ? [...initialColors] : ["#888888"]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  const active = colors[activeIndex] ?? colors[0] ?? "#888888";
  const hsv = hexToHsv(active);
  const cmyk = hexToCmyk(active);

  function setActive(hex: string) {
    setColors((prev) => prev.map((c, i) => (i === activeIndex ? normalizeHex(hex) : c)));
    setSaveState("idle");
  }

  function setFromHsv(h: number, s: number, v: number) {
    setActive(hsvToHex(h, s, v));
  }

  function updateCmyk(part: "c" | "m" | "y" | "k", value: number) {
    const next = { ...cmyk, [part]: value };
    setActive(cmykToHex(next.c, next.m, next.y, next.k));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...colors];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setColors(next);
    setActiveIndex(target);
    setSaveState("idle");
  }

  function submit() {
    setSaveState("saving");
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("colors", JSON.stringify(colors.map((hex) => ({ hex }))));
    void updatePaletteColorsAction(fd).then(() => setSaveState("saved"));
  }

  const num = (v: number) => Math.round(v * 100);

  return (
    <form ref={formRef} action={submit} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap gap-2">
        {colors.map((hex, i) => (
          <button
            type="button"
            key={`${hex}-${i}`}
            onClick={() => setActiveIndex(i)}
            aria-label={`Color ${i + 1}: ${hex}`}
            className={`h-10 w-10 rounded-full border-2 ${i === activeIndex ? "border-neutral-100" : "border-neutral-700"}`}
            style={{ backgroundColor: hex }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            setColors((prev) => [...prev, "#888888"]);
            setActiveIndex(colors.length);
            setSaveState("idle");
          }}
          className="h-10 w-10 rounded-full border border-dashed border-neutral-600 text-neutral-400"
          aria-label="Add color"
        >
          ＋
        </button>
      </div>

      {colors.length > 1 ? (
        <div className="mt-2 flex gap-1 text-xs">
          <button type="button" onClick={() => move(activeIndex, -1)} className="rounded border border-neutral-700 px-2 py-1">
            ‹ move
          </button>
          <button type="button" onClick={() => move(activeIndex, 1)} className="rounded border border-neutral-700 px-2 py-1">
            move ›
          </button>
          <button
            type="button"
            onClick={() => {
              setColors((prev) => prev.filter((_, i) => i !== activeIndex));
              setActiveIndex(0);
              setSaveState("idle");
            }}
            className="rounded border border-neutral-700 px-2 py-1 text-red-400"
          >
            ✕ remove
          </button>
        </div>
      ) : null}

      {/* SV area + hue slider */}
      <div className="mt-4">
        <div
          role="slider"
          aria-label="Saturation and value"
          tabIndex={0}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const move = (ev: PointerEvent | React.PointerEvent) => {
              const evp = "clientX" in ev ? ev : (ev as React.PointerEvent);
              const x = Math.min(1, Math.max(0, (evp.clientX - rect.left) / rect.width));
              const y = Math.min(1, Math.max(0, (evp.clientY - rect.top) / rect.height));
              setFromHsv(hsv.h, x, 1 - y);
            };
            move(e);
            const onMove = (ev: PointerEvent) => move(ev);
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
          className="relative h-36 w-full cursor-crosshair rounded-lg"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 1, 1)})`,
          }}
        >
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: active }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(hsv.h)}
          onChange={(e) => setFromHsv(parseInt(e.target.value, 10), hsv.s, hsv.v)}
          aria-label="Hue"
          className="mt-2 w-full"
          style={{ accentColor: hsvToHex(hsv.h, 1, 1) }}
        />
      </div>

      {/* numeric entry */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="text-xs text-neutral-500">
          HEX
          <input
            type="text"
            defaultValue={active}
            key={active}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (isHexColor(v)) setActive(normalizeHex(v));
              else e.target.value = active;
            }}
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-xs"
          />
        </label>
        {(["r", "g", "b"] as const).map((ch, i) => (
          <label key={ch} className="text-xs text-neutral-500">
            {ch.toUpperCase()}
            <input
              type="number"
              min={0}
              max={255}
              key={`${ch}-${active}`}
              defaultValue={Math.round(parseInt(active.slice(1 + i * 2, 3 + i * 2), 16))}
              onBlur={(e) => {
                const rgb = [parseInt(active.slice(1, 3), 16), parseInt(active.slice(3, 5), 16), parseInt(active.slice(5, 7), 16)];
                rgb[i] = Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0));
                setActive(
                  "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join(""),
                );
              }}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-xs"
            />
          </label>
        ))}
        {(["c", "m", "y", "k"] as const).map((ch) => (
          <label key={ch} className="text-xs text-neutral-500">
            {ch.toUpperCase()} %
            <input
              type="number"
              min={0}
              max={100}
              key={`${ch}-${active}`}
              defaultValue={num(cmyk[ch])}
              onBlur={(e) => updateCmyk(ch, Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) / 100)}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-xs"
            />
          </label>
        ))}
      </div>

      {/* family presets */}
      <div className="mt-3">
        <p className="text-xs text-neutral-500">
          Family: <span className="text-neutral-300">{hexToFamily(active)}</span> — presets:
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {COLOR_FAMILIES.map((family) => (
            <button
              type="button"
              key={family}
              onClick={() => setActive(FAMILY_PRESET[family])}
              aria-label={family}
              title={family}
              className="h-7 w-7 rounded-full border border-neutral-700"
              style={{ backgroundColor: FAMILY_PRESET[family] }}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saveState === "saving"}
        className="mt-4 w-full rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 min-h-[40px]"
      >
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Apply colors"}
      </button>
    </form>
  );
}
