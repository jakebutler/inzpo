"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, Images, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BOARD_PRESETS, BOARD_PRESET_LABELS, BACKGROUND_PRESETS, isValidHex, type BoardPresetName } from "@/lib/board-shared";
import { deleteBoardAction } from "@/app/actions/boards";
import { LibraryPicker, type PickerRow } from "./LibraryPicker";

export function ControlsSheet({
  id,
  board,
  busy,
  onTitle,
  onBackground,
  onPreset,
  onAutoArrange,
  onAddItems,
  exclude,
  facets,
  families,
  freeTags,
  trigger,
}: {
  id: string;
  board: { title: string; background: string; canvasW: number; canvasH: number };
  busy?: boolean;
  onTitle: (title: string) => void;
  onBackground: (hex: string) => void;
  onPreset: (preset: string) => void;
  onAutoArrange: () => void;
  onAddItems: (rows: PickerRow[]) => void;
  exclude: string[];
  facets: Array<{ id: string; name: string; values: string[] }>;
  families: string[];
  freeTags: string[];
  trigger: ReactNode;
}) {
  const [desktop, setDesktop] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board.title);
  const [hexDraft, setHexDraft] = useState("");

  useEffect(() => {
    const q = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);

  const currentPreset =
    (Object.keys(BOARD_PRESETS) as BoardPresetName[]).find(
      (k) => BOARD_PRESETS[k].w === board.canvasW && BOARD_PRESETS[k].h === board.canvasH,
    ) ?? "free";

  function submitTitle(e: React.FormEvent) {
    e.preventDefault();
    const t = titleDraft.trim();
    if (!t || t === board.title) return;
    onTitle(t);
  }

  function submitHex(e: React.FormEvent) {
    e.preventDefault();
    const hex = hexDraft.trim();
    if (!isValidHex(hex)) {
      toast.error("Enter a hex color like #1c1c1c.");
      return;
    }
    onBackground(hex);
    setHexDraft("");
  }

  const section = "space-y-1.5";
  const sectionLabel = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side={desktop ? "right" : "bottom"} className="overflow-y-auto p-4">
        <SheetHeader className="p-0 pb-3">
          <SheetTitle>Board settings</SheetTitle>
          <SheetDescription>Layout saves automatically as you arrange.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-1">
          <section className={section}>
            <h3 className={sectionLabel}>Title</h3>
            <form onSubmit={submitTitle} className="flex items-center gap-1.5">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={120}
                aria-label="Board title"
                className="h-8"
              />
              <Button type="submit" variant="outline" size="sm" disabled={busy || titleDraft.trim() === board.title}>
                Save
              </Button>
            </form>
          </section>

          <section className={section}>
            <h3 className={sectionLabel}>Background</h3>
            <div className="flex flex-wrap items-center gap-2">
              {BACKGROUND_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={board.background === hex}
                  aria-label={`Background ${hex}`}
                  onClick={() => onBackground(hex)}
                  className={`h-9 w-9 rounded-full border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    board.background === hex ? "border-ring" : "border-border"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <form onSubmit={submitHex} className="flex items-center gap-1">
                <Input
                  value={hexDraft}
                  onChange={(e) => setHexDraft(e.target.value)}
                  placeholder="#1c1c1c"
                  aria-label="Custom background hex"
                  maxLength={7}
                  className="h-8 w-24 font-mono text-xs"
                />
                <Button type="submit" variant="outline" size="sm" disabled={busy}>
                  Apply
                </Button>
              </form>
            </div>
          </section>

          <section className={section}>
            <h3 className={sectionLabel}>Output size</h3>
            <Select value={currentPreset} onValueChange={onPreset}>
              <SelectTrigger className="h-8 w-full text-sm" aria-label="Output size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BOARD_PRESETS) as BoardPresetName[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {BOARD_PRESET_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Items are refitted to stay inside the canvas.</p>
          </section>

          <section className={section}>
            <h3 className={sectionLabel}>Arrange</h3>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                title="Repacks every item into an even grid — resets hand tweaks"
                onClick={onAutoArrange}
              >
                <Images className="h-4 w-4" /> Auto-arrange
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" /> Add items
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-44 gap-0.5 p-1.5">
                  {(["png", "webp"] as const).flatMap((format) =>
                    [1, 2].map((scale) => (
                      <a
                        key={`${format}-${scale}`}
                        href={`/boards/${id}/export?format=${format}&scale=${scale}`}
                        download
                        className="flex min-h-[32px] items-center justify-between rounded-md px-1.5 text-sm hover:bg-accent"
                      >
                        <span>{format.toUpperCase()}</span>
                        <span className="text-xs text-muted-foreground">{scale}×</span>
                      </a>
                    )),
                  )}
              </PopoverContent>
              </Popover>
            </div>
          </section>

          <section className={section}>
            <h3 className={sectionLabel}>Danger</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="text-red-400">
                  <Trash2 className="h-4 w-4" /> Delete board
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{board.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The board and its layout are removed. Its Items are NOT deleted — they stay in your library.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form action={deleteBoardAction} className="contents">
                    <input type="hidden" name="id" value={id} />
                    <AlertDialogAction asChild>
                      <Button type="submit" variant="destructive">
                        Delete board
                      </Button>
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </div>

        <LibraryPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          exclude={exclude}
          facets={facets}
          families={families}
          freeTags={freeTags}
          onAdd={(rows) => {
            onAddItems(rows);
            setPickerOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
