"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Hand, Magnet, Maximize, Settings2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BOARD_PRESETS,
  MAX_PLACEMENTS,
  MIN_PLACEMENT_SIZE,
  clampPlacement,
  isValidHex,
  type BoardPresetName,
} from "@/lib/board-shared";
import type { PlacementData } from "@/lib/boards";
import { contentBottom, packGridBand, packGridFull } from "@/lib/board-arrange";
import { savePlacementsAction, updateBoardAction } from "@/app/actions/boards";
import { ControlsSheet } from "./ControlsSheet";
import type { PickerRow } from "./LibraryPicker";

const SNAP = 8;
const MIN_SCALE = 0.08;
const MAX_SCALE = 3;

const VARIANT_WIDTHS: Record<string, number> = { w256: 256, w640: 640, w1600: 1600 };

function variantFor(variants: Record<string, string> | null, targetW: number): string | null {
  if (!variants) return null;
  const entries = Object.entries(variants)
    .filter(([name]) => name in VARIANT_WIDTHS)
    .sort((a, b) => VARIANT_WIDTHS[a[0]] - VARIANT_WIDTHS[b[0]]);
  if (entries.length === 0) return null;
  const fit = entries.find(([name]) => VARIANT_WIDTHS[name] >= targetW);
  return (fit ?? entries[entries.length - 1])[1];
}

function isLight(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 140;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function Tile({ p, background }: { p: PlacementData; background: string }) {
  const wantsImage = p.kind === "screenshot" || p.kind === "photo" || p.mediaRole === "preview";
  const key = wantsImage ? variantFor(p.variants, Math.min(p.w, 1600)) : null;
  if (key) {
    return <img src={`/media/${key}`} alt="" draggable={false} className="pointer-events-none h-full w-full rounded-lg object-cover" />;
  }
  if (p.kind === "palette" && p.colors.length > 0) {
    return (
      <span className="flex h-full w-full overflow-hidden rounded-lg">
        {p.colors.map((hex, i) => (
          <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
        ))}
      </span>
    );
  }
  const light = isLight(background);
  return (
    <span
      className={`flex h-full w-full flex-col justify-center gap-0.5 overflow-hidden rounded-lg px-2 text-left ${
        light ? "bg-[#e4e4e7] text-[#18181b]" : "bg-[#262626] text-[#e4e4e7]"
      }`}
    >
      <span className="line-clamp-3 text-xs leading-tight">{p.title ?? "Untitled"}</span>
      {hostOf(p.sourceUrl) ? (
        <span className={`truncate text-[10px] ${light ? "text-[#52525b]" : "text-[#a1a1aa]"}`}>{hostOf(p.sourceUrl)}</span>
      ) : null}
    </span>
  );
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  orig: { x: number; y: number; w: number; h: number };
  moved: boolean;
  dx?: number;
  dy?: number;
}

type Gesture =
  | { kind: "none" }
  | { kind: "pan"; pointerId: number; lastX: number; lastY: number }
  | { kind: "pinch"; d0: number; scale0: number; wx: number; wy: number }
  | { kind: "maybe-deselect"; pointerId: number; x: number; y: number };

interface BoardShape {
  id: string;
  title: string;
  background: string;
  canvasW: number;
  canvasH: number;
  placements: PlacementData[];
}

export function BoardEditor({
  board,
  facets,
  families,
  freeTags,
}: {
  board: BoardShape;
  facets: Array<{ id: string; name: string; values: string[] }>;
  families: string[];
  freeTags: string[];
}) {
  const [items, setItems] = useState<PlacementData[]>(() => board.placements);
  const itemsRef = useRef(items);
  const [meta, setMeta] = useState({
    title: board.title,
    background: board.background,
    canvasW: board.canvasW,
    canvasH: board.canvasH,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [hand, setHand] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [zoomPct, setZoomPct] = useState(100);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [metaBusy, startMeta] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLElement>());
  const vp = useRef({ x: 0, y: 0, scale: 1 });
  const rafRef = useRef<number | null>(null);
  const zoomLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragWriteRaf = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const justDragged = useRef(false);
  const gesture = useRef<Gesture>({ kind: "none" });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const editsRef = useRef(0);
  const boardIdRef = useRef(board.id);
  const spaceHeld = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyViewport = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const { x, y, scale } = vp.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    el.style.setProperty("--inv", String(1 / scale));
  }, []);

  const scheduleViewport = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyViewport();
    });
    if (zoomLabelTimer.current) clearTimeout(zoomLabelTimer.current);
    zoomLabelTimer.current = setTimeout(() => setZoomPct(Math.round(vp.current.scale * 100)), 200);
  }, [applyViewport]);

  const fitToView = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const pad = 24;
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min((r.width - pad * 2) / meta.canvasW, (r.height - pad * 2) / meta.canvasH)),
    );
    vp.current = {
      scale,
      x: (r.width - meta.canvasW * scale) / 2,
      y: (r.height - meta.canvasH * scale) / 2,
    };
    setZoomPct(Math.round(scale * 100));
    scheduleViewport();
  }, [meta.canvasW, meta.canvasH, scheduleViewport]);

  useEffect(() => {
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (zoomLabelTimer.current) clearTimeout(zoomLabelTimer.current);
      if (dragWriteRaf.current !== null) cancelAnimationFrame(dragWriteRaf.current);
      dragWriteRaf.current = null;
      if (saveTimer.current) {
        // Flush a debounced save that never fired so navigating away can't lose edits.
        clearTimeout(saveTimer.current);
        const fd = new FormData();
        fd.set("id", boardIdRef.current);
        fd.set(
          "placements",
          JSON.stringify(
            itemsRef.current.map((p, i) => ({
              itemId: p.itemId,
              x: p.x,
              y: p.y,
              w: p.w,
              h: p.h,
              z: i,
              showLabel: p.showLabel,
            })),
          ),
        );
        void savePlacementsAction(fd).catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const v = vp.current;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      if (next === v.scale) return;
      v.x = cx - ((cx - v.x) / v.scale) * next;
      v.y = cy - ((cy - v.y) / v.scale) * next;
      v.scale = next;
      scheduleViewport();
    },
    [scheduleViewport],
  );

  function zoomBy(factor: number) {
    const box = containerRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, factor);
  }

  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = box.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      } else {
        vp.current.x -= e.deltaX;
        vp.current.y -= e.deltaY;
        scheduleViewport();
      }
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [zoomAt, scheduleViewport]);

  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable ||
          !!el.closest("button, a"))
      );
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      spaceHeld.current = true;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function snapV(v: number) {
    return snapOn ? Math.round(v / SNAP) * SNAP : Math.round(v);
  }

  function commit(next: PlacementData[], immediate = false) {
    const re = next.map((p, i) => (p.z === i ? p : { ...p, z: i }));
    itemsRef.current = re;
    setItems(re);
    persist(immediate);
  }

  function commitRect(id: string, rect: Partial<{ x: number; y: number; w: number; h: number }>, immediate = false) {
    const canvas = { w: meta.canvasW, h: meta.canvasH };
    const next = itemsRef.current.map((p) => {
      if (p.id !== id) return p;
      const w = Math.max(MIN_PLACEMENT_SIZE, Math.min(snapV(rect.w ?? p.w), canvas.w));
      const h = Math.max(MIN_PLACEMENT_SIZE, Math.min(snapV(rect.h ?? p.h), canvas.h));
      const x = Math.max(0, Math.min(snapV(rect.x ?? p.x), canvas.w - w));
      const y = Math.max(0, Math.min(snapV(rect.y ?? p.y), canvas.h - h));
      return { ...p, x, y, w, h };
    });
    commit(next, immediate);
  }

  function persist(immediate = false) {
    editsRef.current += 1;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const send = () => {
      const fd = new FormData();
      fd.set("id", boardIdRef.current);
      fd.set(
        "placements",
        JSON.stringify(
          itemsRef.current.map((p, i) => ({
            itemId: p.itemId,
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h,
            z: i,
            showLabel: p.showLabel,
          })),
        ),
      );
      const seq = editsRef.current;
      setSaveState("saving");
      // Chained sends: saves never overlap, so the server can't apply them out of order.
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          await savePlacementsAction(fd);
          if (seq === editsRef.current && !saveTimer.current) setSaveState("saved");
        } catch {
          setSaveState("error");
          toast.error("Couldn't save the board — your layout is kept here.");
        }
      });
    };
    if (immediate) send();
    else saveTimer.current = setTimeout(send, 800);
  }

  function runMeta(fd: FormData, success: string) {
    startMeta(async () => {
      try {
        await updateBoardAction(fd);
        toast.success(success);
      } catch {
        toast.error("That didn't go through — try again.");
      }
    });
  }

  function setBoardTitle(title: string) {
    setMeta((m) => ({ ...m, title }));
    const fd = new FormData();
    fd.set("id", board.id);
    fd.set("title", title);
    runMeta(fd, "Title saved.");
  }

  function setBoardBackground(background: string) {
    if (!isValidHex(background) || background.toLowerCase() === meta.background.toLowerCase()) return;
    setMeta((m) => ({ ...m, background: background.toLowerCase() }));
    const fd = new FormData();
    fd.set("id", board.id);
    fd.set("background", background.toLowerCase());
    runMeta(fd, "Background saved.");
  }

  function setBoardPreset(preset: string) {
    const dims = BOARD_PRESETS[preset as BoardPresetName];
    if (!dims || (dims.w === meta.canvasW && dims.h === meta.canvasH)) return;
    setMeta((m) => ({ ...m, canvasW: dims.w, canvasH: dims.h }));
    const canvas = { w: dims.w, h: dims.h };
    const next = itemsRef.current.map((p) => {
      const c = clampPlacement(p, canvas);
      return c ? { ...p, ...c } : p;
    });
    itemsRef.current = next;
    setItems(next);
    const fd = new FormData();
    fd.set("id", board.id);
    fd.set("preset", preset);
    runMeta(fd, "Output size saved — items refitted.");
  }

  function autoArrange() {
    const rects = packGridFull(itemsRef.current.length, { w: meta.canvasW, h: meta.canvasH });
    commit(
      itemsRef.current.map((p, i) => (rects[i] ? { ...p, ...rects[i] } : p)),
      true,
    );
  }

  function addItems(rows: PickerRow[]) {
    const room = MAX_PLACEMENTS - itemsRef.current.length;
    const picked = rows.slice(0, Math.max(0, room));
    if (picked.length === 0) {
      toast.error(`The board is full — ${MAX_PLACEMENTS} items max.`);
      return;
    }
    if (picked.length < rows.length) toast.info(`Board is full — added the first ${picked.length}.`);
    const canvas = { w: meta.canvasW, h: meta.canvasH };
    const bottom = contentBottom(
      itemsRef.current.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
      canvas,
    );
    const rects = packGridBand(picked.length, canvas, bottom);
    const base = itemsRef.current.length;
    const additions: PlacementData[] = picked.map((row, i) => ({
      id: `p-${crypto.randomUUID()}`,
      itemId: row.id,
      x: rects[i].x,
      y: rects[i].y,
      w: rects[i].w,
      h: rects[i].h,
      z: base + i,
      showLabel: false,
      kind: row.kind as PlacementData["kind"],
      title: row.title,
      sourceUrl: null,
      variants: row.thumb ? { w256: row.thumb } : null,
      mediaRole: null,
      colors: row.colors,
    }));
    commit([...itemsRef.current, ...additions], true);
  }

  function removePlacement(id: string) {
    const idx = itemsRef.current.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const next = itemsRef.current.filter((p) => p.id !== id);
    setPopoverOpen(false);
    setSelectedId(null);
    commit(next, true);
    const focusTarget = next[Math.min(idx, next.length - 1)];
    if (focusTarget) {
      requestAnimationFrame(() => buttonRefs.current.get(focusTarget.id)?.focus());
    } else {
      containerRef.current?.focus();
    }
  }

  function moveLayer(id: string, dir: 1 | -1) {
    const arr = itemsRef.current;
    const i = arr.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= arr.length) return;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  function toggleLabel(id: string) {
    commit(
      itemsRef.current.map((p) => (p.id === id ? { ...p, showLabel: !p.showLabel } : p)),
    );
  }

  function abortDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const el = buttonRefs.current.get(d.id);
    if (el) {
      el.style.left = `${d.orig.x}px`;
      el.style.top = `${d.orig.y}px`;
      el.style.width = `${d.orig.w}px`;
      el.style.height = `${d.orig.h}px`;
    }
  }

  function scheduleDragWrite(d: DragState, dx: number, dy: number) {
    if (dragWriteRaf.current !== null) cancelAnimationFrame(dragWriteRaf.current);
    dragWriteRaf.current = requestAnimationFrame(() => {
      dragWriteRaf.current = null;
      const el = buttonRefs.current.get(d.id);
      if (!el) return;
      if (d.mode === "move") {
        const x = Math.max(0, Math.min(d.orig.x + dx, meta.canvasW - d.orig.w));
        const y = Math.max(0, Math.min(d.orig.y + dy, meta.canvasH - d.orig.h));
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      } else {
        const w = Math.max(MIN_PLACEMENT_SIZE, Math.min(d.orig.w + dx, meta.canvasW - d.orig.x));
        const h = Math.max(MIN_PLACEMENT_SIZE, Math.min(d.orig.h + dy, meta.canvasH - d.orig.y));
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
    });
  }

  function onPlacementPointerDown(e: React.PointerEvent<HTMLElement>, p: PlacementData, mode: "move" | "resize") {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    justDragged.current = false;
    setSelectedId(p.id);
    setPopoverOpen(false);
    dragRef.current = {
      id: p.id,
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: p.x, y: p.y, w: p.w, h: p.h },
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPlacementPointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (gesture.current.kind === "pinch") {
      abortDrag();
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 3) {
      d.moved = true;
      setPopoverOpen(false);
    }
    if (!d.moved) return;
    d.dx = (e.clientX - d.startX) / vp.current.scale;
    d.dy = (e.clientY - d.startY) / vp.current.scale;
    scheduleDragWrite(d, d.dx, d.dy);
  }

  function onPlacementPointerUp(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId) return;
    justDragged.current = d.moved;
    if (!d.moved) return;
    // Compute the final rect from pointer deltas, not from styles: a queued drag-write
    // frame may not have painted yet (stale-style reads were possible at high pointer speeds).
    if (dragWriteRaf.current !== null) {
      cancelAnimationFrame(dragWriteRaf.current);
      dragWriteRaf.current = null;
    }
    if (d.mode === "move") {
      commitRect(d.id, { x: d.orig.x + (d.dx ?? 0), y: d.orig.y + (d.dy ?? 0) });
    } else {
      commitRect(d.id, { w: d.orig.w + (d.dx ?? 0), h: d.orig.h + (d.dy ?? 0) });
    }
  }

  function onPlacementKeyDown(e: React.KeyboardEvent, p: PlacementData) {
    const step = e.shiftKey ? SNAP * 10 : SNAP;
    const dirs: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (e.key in dirs) {
      e.preventDefault();
      const [dx, dy] = dirs[e.key];
      if (e.altKey) commitRect(p.id, { w: p.w + dx * step, h: p.h + dy * step });
      else commitRect(p.id, { x: p.x + dx * step, y: p.y + dy * step });
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removePlacement(p.id);
    }
  }

  function onCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest?.("[data-radix-popper-content-wrapper]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = e.currentTarget.getBoundingClientRect();
      const v = vp.current;
      gesture.current = {
        kind: "pinch",
        d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        scale0: v.scale,
        wx: ((a.x + b.x) / 2 - r.left - v.x) / v.scale,
        wy: ((a.y + b.y) / 2 - r.top - v.y) / v.scale,
      };
      abortDrag();
      return;
    }
    const onPlacement = !!(e.target as HTMLElement).closest("[data-placement]");
    if (onPlacement) return;
    if (hand || spaceHeld.current || e.button === 1) {
      gesture.current = { kind: "pan", pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      gesture.current = { kind: "maybe-deselect", pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function onCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (g.kind === "pan" && g.pointerId === e.pointerId) {
      vp.current.x += e.clientX - g.lastX;
      vp.current.y += e.clientY - g.lastY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      scheduleViewport();
    } else if (g.kind === "pinch" && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const r = e.currentTarget.getBoundingClientRect();
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const cx = (a.x + b.x) / 2 - r.left;
      const cy = (a.y + b.y) / 2 - r.top;
      const v = vp.current;
      v.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.scale0 * (d / g.d0)));
      v.x = cx - g.wx * v.scale;
      v.y = cy - g.wy * v.scale;
      scheduleViewport();
    } else if (g.kind === "maybe-deselect" && g.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) gesture.current = { kind: "none" };
    }
  }

  function onCanvasPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = { kind: "none" };
      return;
    }
    if (g.kind === "maybe-deselect" && g.pointerId === e.pointerId) {
      setSelectedId(null);
      setPopoverOpen(false);
    }
    if (g.kind === "pan" && g.pointerId === e.pointerId) gesture.current = { kind: "none" };
  }

  const selected = items.find((p) => p.id === selectedId) ?? null;
  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "";

  const toolButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground aria-pressed:border-ring aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          <Link
            href="/boards"
            aria-label="Back to boards"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-sm font-semibold">{meta.title}</h1>
            <p className="text-[11px] text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"} · {meta.canvasW}×{meta.canvasH}
            </p>
          </div>
          <p role="status" aria-live="polite" className="mr-1 text-xs text-muted-foreground">
            {saveLabel}
          </p>
          <button
            type="button"
            aria-pressed={hand}
            aria-label="Hand tool — drag the canvas to pan"
            title="Hand tool (or hold space) to pan"
            onClick={() => setHand((v) => !v)}
            className={toolButton}
          >
            <Hand className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)} className={toolButton}>
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground" aria-hidden>
            {zoomPct}%
          </span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.2)} className={toolButton}>
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Fit board to view" title="Fit to view" onClick={fitToView} className={toolButton}>
            <Maximize className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-pressed={snapOn}
            aria-label="Snap to grid"
            title="Snap to grid (8 units)"
            onClick={() => setSnapOn((v) => !v)}
            className={toolButton}
          >
            <Magnet className="h-4 w-4" />
          </button>
          <ControlsSheet
            id={board.id}
            board={meta}
            busy={metaBusy}
            onTitle={setBoardTitle}
            onBackground={setBoardBackground}
            onPreset={setBoardPreset}
            onAutoArrange={autoArrange}
            onAddItems={addItems}
            exclude={items.map((p) => p.itemId)}
            facets={facets}
            families={families}
            freeTags={freeTags}
            trigger={
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4" /> Board
              </Button>
            }
          />
        </div>
      </header>

      <div
        ref={containerRef}
        role="group"
        aria-label={`Board canvas, ${meta.canvasW} by ${meta.canvasH}. Drag items to move them; arrow keys nudge a selected item.`}
        tabIndex={-1}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-neutral-950 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
      >
        <div
          ref={stageRef}
          className="absolute top-0 left-0 origin-top-left border border-neutral-700 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ width: meta.canvasW, height: meta.canvasH, backgroundColor: meta.background }}
        >
          {items.map((p) => {
            const isSelected = p.id === selectedId;
            return (
              <Popover key={p.id} open={popoverOpen && isSelected} onOpenChange={setPopoverOpen}>
                <PopoverTrigger
                  asChild
                  onClickCapture={(e) => {
                    if (justDragged.current) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  <button
                    type="button"
                    data-placement
                    data-placement-id={p.id}
                    ref={(el) => {
                      if (el) buttonRefs.current.set(p.id, el);
                      else buttonRefs.current.delete(p.id);
                    }}
                    aria-label={`Item ${p.title ?? "Untitled"}`}
                    className={`absolute block rounded-lg p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                      isSelected ? "outline-2 -outline-offset-4 outline-sky-400 outline" : ""
                    }`}
                    style={{ left: p.x, top: p.y, width: p.w, height: p.h, zIndex: p.z }}
                    onPointerDown={(e) => onPlacementPointerDown(e, p, "move")}
                    onPointerMove={onPlacementPointerMove}
                    onPointerUp={onPlacementPointerUp}
                    onPointerCancel={() => {
                      dragRef.current = null;
                    }}
                    onKeyDown={(e) => onPlacementKeyDown(e, p)}
                  >
                    <Tile p={p} background={meta.background} />
                    {p.showLabel ? (
                      <span className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-lg bg-black/65 px-1.5 py-0.5 text-[10px] leading-tight text-white">
                        <span className="line-clamp-1">{p.title ?? "Untitled"}</span>
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span
                        aria-hidden
                        className="absolute flex cursor-nwse-resize touch-none items-center justify-center"
                        style={{
                          width: "calc(28px * var(--inv, 1))",
                          height: "calc(28px * var(--inv, 1))",
                          right: "calc(-14px * var(--inv, 1))",
                          bottom: "calc(-14px * var(--inv, 1))",
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPlacementPointerDown(e, p, "resize");
                        }}
                      >
                        <span className="h-2.5 w-2.5 rounded-sm border border-white bg-sky-500 shadow" />
                      </span>
                    ) : null}
                  </button>
                </PopoverTrigger>
                {isSelected ? (
                  <PopoverContent side="top" align="center" className="w-48 gap-1 p-1.5">
                    <p className="truncate px-1.5 pb-1 text-xs font-medium text-muted-foreground">{p.title ?? "Untitled"}</p>
                    <button
                      type="button"
                      onClick={() => toggleLabel(p.id)}
                      aria-pressed={p.showLabel}
                      className="flex min-h-[32px] w-full items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent"
                    >
                      <span className="flex h-4 w-4 items-center justify-center">{p.showLabel ? "✓" : ""}</span>
                      Show label
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLayer(p.id, 1)}
                      disabled={p.z >= items.length - 1}
                      className="flex min-h-[32px] w-full items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent disabled:opacity-40"
                    >
                      Bring forward
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLayer(p.id, -1)}
                      disabled={p.z <= 0}
                      className="flex min-h-[32px] w-full items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent disabled:opacity-40"
                    >
                      Send backward
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlacement(p.id)}
                      className="flex min-h-[32px] w-full items-center gap-2 rounded-md px-1.5 text-sm text-red-400 hover:bg-accent"
                    >
                      Remove from board
                    </button>
                  </PopoverContent>
                ) : null}
              </Popover>
            );
          })}
        </div>
        {items.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-neutral-400">
              The canvas is empty — open <span className="text-neutral-200">Board → Add items</span> to place Items from your
              library.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
