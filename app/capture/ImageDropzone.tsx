"use client";

import { useRef, useState } from "react";

export function ImageDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pick(next: File | null) {
    setFile(next);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors min-h-[160px] flex flex-col items-center justify-center gap-3 ${
          dragging ? "border-neutral-400 bg-neutral-800" : "border-neutral-700 bg-neutral-900 hover:border-neutral-600"
        }`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Selected image" className="max-h-64 rounded-lg" />
        ) : (
          <>
            <span className="text-3xl" aria-hidden>
              ⬆
            </span>
            <span className="text-neutral-300">Drop an image here, or tap to pick</span>
            <span className="text-xs text-neutral-500">PNG · JPEG · WebP · GIF · AVIF</span>
          </>
        )}
      </button>
      {file ? (
        <p className="mt-2 truncate text-sm text-neutral-400" aria-live="polite">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </p>
      ) : null}
    </div>
  );
}
