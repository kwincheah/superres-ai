"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Wand2, Heart, Github } from "lucide-react";
import ControlPanel, { type EnhanceFormData } from "@/components/ControlPanel";
import ImageCompare from "@/components/ImageCompare";
import type {
  ApiErrorResponse,
  CreateUpscaleJobResponse,
  GetUpscaleJobResponse,
  JobStatus,
} from "@/lib/types";

const DEFAULT_BACKEND_URL = "https://superres-ai-flax.vercel.app";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 120;
const SUPABASE_STORAGE_URL = "https://eqdfrfjfqpbkmcuvggyl.supabase.co/storage/v1/object/public/images";

function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string";
}

function statusLabel(status: JobStatus | null) {
  if (!status) return "Idle";
  if (status === "queued") return "Queued";
  if (status === "processing") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Cancelled";
}

async function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function HomePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [upscaledImageUrl, setUpscaledImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const backendBaseUrl = useMemo(() => getBackendBaseUrl(), []);
  const hasImage = Boolean(originalPreviewUrl);

  const setPreviewUrl = useCallback((file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setOriginalPreviewUrl(nextPreviewUrl);
  }, []);

  const clearResult = useCallback(() => {
    setUpscaledImageUrl(null);
    setOriginalPreviewUrl(null);
    setJobId(null);
    setJobStatus(null);
    setError(null);
  }, []);

  const fetchJob = useCallback(
    async (currentJobId: string): Promise<GetUpscaleJobResponse> => {
      const response = await fetch(`${backendBaseUrl}/api/v1/jobs/${currentJobId}`, { method: "GET" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        if (isApiErrorResponse(payload)) throw new Error(payload.error.message);
        throw new Error("Failed to fetch job status.");
      }
      return payload as GetUpscaleJobResponse;
    },
    [backendBaseUrl]
  );

  const pollUntilComplete = useCallback(
    async (currentJobId: string) => {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        const result = await fetchJob(currentJobId);
        const status = result.job.status;
        setJobStatus(status);

        if (status === "completed") {
          if (!result.job.outputPath) throw new Error("Job completed without an output image.");
          setUpscaledImageUrl(`${SUPABASE_STORAGE_URL}/${result.job.outputPath}`);
          return;
        }
        if (status === "failed") throw new Error(result.job.errorMessage ?? "Enhancement failed.");
        if (status === "cancelled") throw new Error("Enhancement job was cancelled.");

        await wait(POLL_INTERVAL_MS);
      }
      throw new Error("Enhancement timed out. Please try again.");
    },
    [fetchJob]
  );

  const handleEnhance = useCallback(
    async (data: EnhanceFormData) => {
      setIsSubmitting(true);
      setError(null);
      setUpscaledImageUrl(null);
      setJobId(null);
      setJobStatus(null);
      setPreviewUrl(data.file);

      try {
        const formData = new FormData();
        formData.append("file", data.file);
        formData.append("model", data.model);
        formData.append("scale", String(data.scale));
        formData.append("faceEnhance", String(data.faceEnhance));

        const response = await fetch(`${backendBaseUrl}/api/v1/jobs`, { method: "POST", body: formData });
        const payload: unknown = await response.json();

        if (!response.ok) {
          if (isApiErrorResponse(payload)) throw new Error(payload.error.message);
          throw new Error("Failed to create enhancement job.");
        }

        const createResult = payload as CreateUpscaleJobResponse;
        setJobId(createResult.jobId);
        setJobStatus(createResult.status);
        await pollUntilComplete(createResult.jobId);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unexpected error.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [backendBaseUrl, pollUntilComplete, setPreviewUrl]
  );

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-indigo-200/40 blur-[120px]" />
        <div className="absolute -right-[10%] top-[20%] h-[30%] w-[30%] rounded-full bg-purple-200/40 blur-[100px]" />
      </div>

      {/* Header */}
      {/* Enhanced Sticky Navbar */}
      {/* Enhanced Sticky Navbar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 text-indigo-600 transition hover:opacity-80">
            <Wand2 className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight text-slate-900">
              SuperRes<span className="text-indigo-600">AI</span>
            </span>
          </Link>
          
          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <Link href="/how-it-works" className="transition hover:text-indigo-600">
              How it Works
            </Link>
            <a 
              href="https://buymeacoffee.com/kenwincheah" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 transition hover:text-rose-600"
            >
              <Heart className="h-4 w-4" />
              Donate / Sponsor
            </a>
          </nav>

          {/* Right Actions & CTA */}
          <div className="flex items-center gap-5">
            <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-900 sm:block">
              Sign In
            </Link>
            
            <Link href="/signup" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300">
              Sign Up
            </Link>
          </div>
          
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-1 flex-col mx-auto w-full max-w-7xl px-4 py-8 md:px-8 lg:py-12">

        {/* Dynamic Hero Section */}
        {!hasImage && (
          <div className="flex flex-1 flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="mb-10 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                AI Image Super-Resolution
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Instantly upsample and enhance your images using state-of-the-art neural networks. Crystal clear results in seconds.
              </p>
            </div>

            <div className="w-full max-w-3xl">
              <div className="rounded-3xl border border-white bg-white/60 p-2 shadow-2xl shadow-slate-200/50 backdrop-blur-xl md:p-4">
                <ControlPanel onEnhance={handleEnhance} isSubmitting={isSubmitting} />
              </div>
            </div>
          </div>
        )}

        {/* Active Workspace State */}
        {/* Active Workspace State */}
        {hasImage && (
          <div className="flex flex-1 flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">

            {/* 1. Main Image View (Centered & Maximized) */}
            <section className="relative flex w-full max-w-5xl flex-col rounded-3xl border border-slate-200/60 bg-white p-2 shadow-2xl shadow-slate-200/50">
              <div className="relative flex w-full aspect-square md:aspect-video items-center justify-center overflow-hidden rounded-2xl bg-slate-900/5">

                {isSubmitting && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm">
                    <div className="absolute top-0 h-1 w-full animate-[scan_2s_ease-in-out_infinite] bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                    <div className="flex items-center gap-3 rounded-full bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-xl">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                      Enhancing Pixels...
                    </div>
                  </div>
                )}

                <ImageCompare
                  originalSrc={originalPreviewUrl}
                  upscaledSrc={upscaledImageUrl}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            </section>

            {/* 2. Settings Panel (Docked Below) */}
            <div className="mt-8 w-full max-w-3xl rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-md">
              <ControlPanel onEnhance={handleEnhance} isSubmitting={isSubmitting} />

              {/* Status Block */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">Status:</span>
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                    </div>
                  ) : jobStatus === "completed" ? (
                    <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">{statusLabel(jobStatus)}</span>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 text-sm text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="leading-tight">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={clearResult}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" /> Start New Image
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/60 bg-slate-50/50 py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} SuperRes AI. Powered by Real-ESRGAN.
          </p>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            
            {/* Updated Links Here */}
            <Link href="/privacy" className="transition hover:text-slate-900">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-slate-900">Terms of Service</Link>
            
            <a 
              href="https://buymeacoffee.com/YOUR_USERNAME" 
              target="_blank"
              rel="noreferrer" 
              className="flex items-center gap-1 text-rose-600 transition hover:text-rose-700"
            >
              <Heart className="h-4 w-4" />
              Support the project
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
