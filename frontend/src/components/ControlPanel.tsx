"use client";

import { useMemo, useRef, useState, DragEvent } from "react";
import { ImagePlus, Loader2, Sparkles, UploadCloud, X, Settings2 } from "lucide-react";
import { UPSCALE_MODELS, type UpscaleModel } from "@/lib/types";

const SCALE_OPTIONS = [2, 4] as const;

export interface EnhanceFormData {
  file: File;
  model: UpscaleModel;
  scale: 2 | 4;
  faceEnhance: boolean;
}

interface ControlPanelProps {
  onEnhance: (data: EnhanceFormData) => Promise<void> | void;
  isSubmitting?: boolean;
  initialModel?: UpscaleModel;
  initialScale?: 2 | 4;
  initialFaceEnhance?: boolean;
  maxFileSizeMb?: number;
  acceptedMimeTypes?: string[];
  className?: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isUpscaleModel(value: string): value is UpscaleModel {
  return UPSCALE_MODELS.some((model) => model === value);
}

export default function ControlPanel({
  onEnhance,
  isSubmitting = false,
  initialModel = "realesrgan-x4plus",
  initialScale = 4,
  initialFaceEnhance = false,
  maxFileSizeMb = 20,
  acceptedMimeTypes = ["image/jpeg", "image/png", "image/webp"],
  className,
}: ControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<UpscaleModel>(initialModel);
  const [scale, setScale] = useState<2 | 4>(initialScale);
  const [faceEnhance, setFaceEnhance] = useState<boolean>(initialFaceEnhance);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const accept = useMemo(() => acceptedMimeTypes.join(","), [acceptedMimeTypes]);
  const maxBytes = maxFileSizeMb * 1024 * 1024;

  const handleFileChange = (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      setError(null);
      return;
    }

    if (!acceptedMimeTypes.includes(nextFile.type)) {
      setError(`Unsupported file type. Allowed: ${acceptedMimeTypes.join(", ")}`);
      setFile(null);
      return;
    }

    if (nextFile.size > maxBytes) {
      setError(`File is too large. Maximum size is ${maxFileSizeMb}MB.`);
      setFile(null);
      return;
    }

    setError(null);
    setFile(nextFile);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }
    setError(null);
    await onEnhance({ file, model, scale, faceEnhance });
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isSubmitting) return;

    const droppedFile = e.dataTransfer.files?.[0] ?? null;
    handleFileChange(droppedFile);
  };

  // STATE 1: Massive Drag & Drop Zone (No file selected)
  if (!file) {
    return (
      <div className={cn("w-full transition-all duration-300", className)}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 py-24 text-center transition-all duration-300",
            isDragging
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.02]"
              : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
          )}
        >
          <div className="mb-6 rounded-full bg-indigo-100 p-5 text-indigo-600 transition-transform duration-300 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white">
            <UploadCloud className="h-10 w-10" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-slate-800">
            Upload an image
          </h3>
          <p className="mb-8 text-sm text-slate-500">
            Drag and drop your file here, or click to browse
          </p>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300"
          >
            Select File
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
        {error && <p className="mt-4 text-center text-sm font-medium text-rose-500">{error}</p>}
      </div>
    );
  }

  // STATE 2: Settings Sidebar (File selected)
  return (
    <section className={cn("flex w-full flex-col gap-6", className)}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <Settings2 className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-800">Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Selected File Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
          <div className="flex items-center justify-between p-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <ImagePlus className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleFileChange(null)}
              className="ml-2 shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-rose-600"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI Model Selection */}
        <div className="space-y-3">
          <label htmlFor="model" className="block text-sm font-semibold text-slate-700">
            AI Model
          </label>
          <div className="relative">
            <select
              id="model"
              value={model}
              onChange={(e) => {
                const nextModel = e.target.value;
                if (isUpscaleModel(nextModel)) setModel(nextModel);
              }}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              disabled={isSubmitting}
            >
              {UPSCALE_MODELS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Scale Selection */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Upscale Target</p>
          <div className="grid grid-cols-2 gap-3">
            {SCALE_OPTIONS.map((value) => {
              const isActive = scale === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScale(value)}
                  disabled={isSubmitting}
                  className={cn(
                    "rounded-xl border-2 py-3 text-sm font-bold transition-all duration-200",
                    isActive
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-white"
                  )}
                >
                  {value}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Face Enhancement Toggle */}
        <label className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
          <div>
            <span className="block text-sm font-semibold text-slate-700">Face Enhancement</span>
            <span className="mt-0.5 block text-xs text-slate-500">Restore facial details</span>
          </div>
          <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2" style={{ backgroundColor: faceEnhance ? '#4f46e5' : '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={faceEnhance}
              onChange={(e) => setFaceEnhance(e.target.checked)}
              disabled={isSubmitting}
              className="sr-only"
            />
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out shadow-sm",
                faceEnhance ? "translate-x-6" : "translate-x-1"
              )}
            />
          </div>
        </label>

        {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Image...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 transition-transform group-hover:scale-110" />
              Enhance Image
            </>
          )}
        </button>
      </div>
    </section>
  );
}