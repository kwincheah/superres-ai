"use client";

import { useId, useMemo, useState } from "react";
import { MoveHorizontal } from "lucide-react";

interface ImageCompareProps {
  originalSrc: string | null;
  upscaledSrc: string | null;
  originalLabel?: string;
  upscaledLabel?: string;
  alt?: string;
  className?: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ImageCompare({
  originalSrc,
  upscaledSrc,
  originalLabel = "Original",
  upscaledLabel = "Upscaled",
  alt = "Image comparison",
  className,
}: ImageCompareProps) {
  const sliderId = useId();
  const [position, setPosition] = useState(50);

  const isReady = useMemo(() => Boolean(originalSrc && upscaledSrc), [originalSrc, upscaledSrc]);

  if (!isReady) {
    return (
      <div
        className={cn(
          "flex min-h-[280px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500",
          className,
        )}
      >
        Upload and enhance an image to compare results.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="relative isolate aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
        
        {/* Original Image (Bottom Layer) */}
        <img src={originalSrc ?? ""} alt={alt} className="absolute inset-0 h-full w-full object-contain" />

        {/* Upscaled Image (Clipped Top Layer) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img src={upscaledSrc ?? ""} alt={alt} className="h-full w-full object-contain" />
        </div>

        {/* Visual Handle (Pointer events disabled so it doesn't block the invisible input) */}
        <div
          className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
          style={{ left: `${position}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow">
            <MoveHorizontal className="h-4 w-4" />
          </div>
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white z-20">
          {upscaledLabel}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 text-xs font-medium text-white z-20">
          {originalLabel}
        </div>

        {/* The Actual Functional Slider (Invisible, covers the whole image) */}
        <label htmlFor={sliderId} className="sr-only">
          Compare original and upscaled images
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => {
            setPosition(Number(event.target.value));
          }}
          className="absolute inset-0 z-30 m-0 h-full w-full cursor-ew-resize appearance-none opacity-0 touch-pan-y"
          aria-label="Drag slider to compare original and upscaled image"
        />
      </div>
    </div>
  );
}